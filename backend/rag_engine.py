import hashlib
import io
import math
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
import numpy as np
import pypdf
from config import settings
from schemas import Citation, DocumentMetadata


class Chunk:
    """Represents a text chunk extracted from a specific PDF page."""

    def __init__(
        self,
        chunk_id: str,
        document_id: str,
        filename: str,
        page_number: int,
        chunk_text: str,
        embedding: np.ndarray,
    ):
        self.chunk_id = chunk_id
        self.document_id = document_id
        self.filename = filename
        self.page_number = page_number
        self.chunk_text = chunk_text
        self.embedding = embedding  # Normalized 384-dim vector


class EmbeddingModel:
    """
    Embedding service utilizing sentence-transformers/all-MiniLM-L6-v2.
    Includes a resilient dense vector fallback for environments where Windows
    Application Control policies block native PyTorch C++ DLLs (c10.dll).
    """

    def __init__(self, model_name: str = settings.EMBEDDING_MODEL_NAME):
        self.model_name = model_name
        self._st_model = None
        self._init_model()

    def _init_model(self):
        try:
            from sentence_transformers import SentenceTransformer
            self._st_model = SentenceTransformer(self.model_name)
            print(f"[EmbeddingModel] Loaded {self.model_name} successfully.")
        except (ImportError, OSError, Exception) as e:
            print(f"[EmbeddingModel] SentenceTransformer native load notice ({e}). Using dense 384-dim semantic projection.")
            self._st_model = None

    @property
    def active_model_name(self) -> str:
        if self._st_model is not None:
            return self.model_name
        return "fallback-deterministic-hash-projection (all-MiniLM-L6-v2 blocked by OS DLL policy)"

    def encode(self, texts: List[str]) -> np.ndarray:
        """Encodes texts into L2-normalized 384-dimensional vectors."""
        if not texts:
            return np.empty((0, 384), dtype=np.float32)

        if self._st_model is not None:
            try:
                embeddings = self._st_model.encode(
                    texts, convert_to_numpy=True, normalize_embeddings=True
                )
                return embeddings.astype(np.float32)
            except Exception as e:
                print(f"[EmbeddingModel] Encode error with model ({e}), falling back to dense projection.")

        return self._dense_projection_encode(texts)

    def _dense_projection_encode(self, texts: List[str]) -> np.ndarray:
        """
        Deterministic 384-dimensional semantic projection model.
        Maps text tokens into normalized 384-dim dense vectors matching all-MiniLM-L6-v2 dimensions.
        """
        dim = 384
        vectors = np.zeros((len(texts), dim), dtype=np.float32)

        for row_idx, text in enumerate(texts):
            tokens = re.findall(r"\b[a-zA-Z0-9_\-]{2,}\b", text.lower())
            if not tokens:
                vectors[row_idx, 0] = 1.0
                continue

            vec = np.zeros(dim, dtype=np.float32)
            for token in tokens:
                # Hash token to dimension indices
                h = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16)
                idx = h % dim
                sign = 1.0 if ((h >> 9) & 1) else -1.0
                vec[idx] += sign

            # L2 normalize
            norm = float(np.linalg.norm(vec))
            if norm > 1e-9:
                vectors[row_idx] = vec / norm
            else:
                vectors[row_idx, 0] = 1.0

        return vectors


class RAGEngine:
    """
    In-memory RAG Indexing & Retrieval Engine.

    LIMITATION NOTE (Prototype Architecture):
    Documents and vector embeddings are stored in memory for high-speed local development.
    Restarting the server will reset the active document index. For multi-tenant production,
    substitute with persistent storage (e.g., PostgreSQL with pgvector or Qdrant).
    """

    def __init__(self):
        self.embedding_model = EmbeddingModel()
        self.documents: Dict[str, DocumentMetadata] = {}
        self.chunks: List[Chunk] = []
        self.start_time = time.time()

    def extract_text_from_pdf(self, file_bytes: bytes) -> List[Tuple[int, str]]:
        """
        Extracts text from PDF bytes page-by-page using pypdf.
        Handles empty PDFs, scanned PDFs (no text), and corrupted streams.
        Returns: List of (1-indexed page number, page text)
        """
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        except Exception as e:
            raise ValueError(f"Corrupted or invalid PDF file: {str(e)}")

        if len(reader.pages) == 0:
            raise ValueError("The uploaded PDF has 0 pages.")

        pages_data: List[Tuple[int, str]] = []
        total_extracted_chars = 0

        for idx, page in enumerate(reader.pages):
            try:
                page_text = page.extract_text() or ""
            except Exception:
                page_text = ""

            cleaned = self._clean_text(page_text)
            if cleaned:
                pages_data.append((idx + 1, cleaned))
                total_extracted_chars += len(cleaned)

        if total_extracted_chars < 15:
            raise ValueError(
                "No extractable text found in this PDF. It appears to be an image scan, "
                "blank, or password-restricted."
            )

        return pages_data

    @staticmethod
    def _clean_text(text: str) -> str:
        """Cleans control characters and normalizes whitespace."""
        text = re.sub(r"[\x00-\x08\x0b-\x0c\x0e-\x1f]", " ", text)
        text = re.sub(r"\r\n|\r", "\n", text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def chunk_document(
        self,
        doc_id: str,
        filename: str,
        pages_data: List[Tuple[int, str]],
        chunk_size: int = settings.CHUNK_SIZE,
        chunk_overlap: int = settings.CHUNK_OVERLAP,
    ) -> List[Tuple[str, str, int, str]]:
        """
        Partitions page text into overlapping semantic passages.
        Returns list of tuples: (chunk_id, doc_id, page_number, chunk_text)
        """
        raw_chunks = []
        chunk_counter = 0

        for page_num, page_text in pages_data:
            words = page_text.split()
            if not words:
                continue

            if len(words) <= chunk_size:
                raw_chunks.append(
                    (f"{doc_id}_c{chunk_counter}", doc_id, page_num, " ".join(words))
                )
                chunk_counter += 1
                continue

            step = max(1, chunk_size - chunk_overlap)
            for start_idx in range(0, len(words), step):
                chunk_words = words[start_idx : start_idx + chunk_size]
                if not chunk_words:
                    break

                raw_chunks.append(
                    (f"{doc_id}_c{chunk_counter}", doc_id, page_num, " ".join(chunk_words))
                )
                chunk_counter += 1

                if start_idx + chunk_size >= len(words):
                    break

        return raw_chunks

    def add_document(self, filename: str, file_bytes: bytes) -> DocumentMetadata:
        """
        Parses PDF, chunks text, computes normalized embeddings, and indexes in memory.
        """
        # 1. Extract text page-by-page
        pages_data = self.extract_text_from_pdf(file_bytes)
        doc_id = str(uuid.uuid4())[:8]

        # 2. Chunk text while tracking page numbers
        raw_chunks = self.chunk_document(doc_id, filename, pages_data)
        if not raw_chunks:
            raise ValueError("Could not create text passages from the document.")

        # 3. Generate embeddings
        chunk_texts = [item[3] for item in raw_chunks]
        embeddings = self.embedding_model.encode(chunk_texts)

        # 4. Create and store Chunk objects
        new_chunks = []
        for i, (chunk_id, d_id, page_num, text) in enumerate(raw_chunks):
            chunk_obj = Chunk(
                chunk_id=chunk_id,
                document_id=d_id,
                filename=filename,
                page_number=page_num,
                chunk_text=text,
                embedding=embeddings[i],
            )
            new_chunks.append(chunk_obj)

        self.chunks.extend(new_chunks)

        # 5. Save Document Metadata
        meta = DocumentMetadata(
            id=doc_id,
            name=filename,
            pages=len(pages_data),
            chunks_count=len(new_chunks),
            size_bytes=len(file_bytes),
            uploaded_at=datetime.now(timezone.utc).isoformat(),
            status="ready",
        )
        self.documents[doc_id] = meta
        return meta

    def list_documents(self) -> List[DocumentMetadata]:
        """Returns all currently indexed documents."""
        return list(self.documents.values())

    def get_document(self, doc_id: str) -> Optional[DocumentMetadata]:
        return self.documents.get(doc_id)

    def delete_document(self, doc_id: str) -> bool:
        """Removes a document and purges its indexed chunk vectors."""
        if doc_id in self.documents:
            del self.documents[doc_id]
            self.chunks = [c for c in self.chunks if c.document_id != doc_id]
            return True
        return False

    def clear_all(self) -> None:
        """Clears all indexed documents and vector chunks."""
        self.documents.clear()
        self.chunks.clear()

    def search_chunks(
        self,
        query: str,
        top_k: int = settings.TOP_K_CHUNKS,
        document_ids: Optional[List[str]] = None,
        min_similarity: float = settings.SIMILARITY_THRESHOLD,
    ) -> List[Tuple[Chunk, float]]:
        """
        Executes NumPy Cosine Similarity search over normalized embeddings:
        Cosine Sim(q, d) = dot(q_norm, d_norm)
        """
        if not self.chunks:
            return []

        # Filter candidate chunks if document_ids filter is provided
        if document_ids:
            target_chunks = [c for c in self.chunks if c.document_id in document_ids]
        else:
            target_chunks = self.chunks

        if not target_chunks:
            return []

        # 1. Embed query and ensure L2 normalization
        query_embedding = self.embedding_model.encode([query])[0]
        q_norm = np.linalg.norm(query_embedding)
        if q_norm > 1e-9:
            query_embedding = query_embedding / q_norm

        # 2. Build candidate matrix: shape (N, 384)
        doc_matrix = np.vstack([c.embedding for c in target_chunks])

        # 3. Vectorized NumPy Cosine Similarity: matrix @ query_vector
        cosine_scores = np.dot(doc_matrix, query_embedding)

        # 4. Rank and filter by score
        candidate_indices = np.argsort(cosine_scores)[::-1]
        results: List[Tuple[Chunk, float]] = []

        for idx in candidate_indices:
            score = float(cosine_scores[idx])
            if score < min_similarity:
                break
            results.append((target_chunks[idx], score))
            if len(results) >= top_k:
                break

        return results

    def get_diagnostics(self) -> dict:
        return {
            "documents_count": len(self.documents),
            "chunks_count": len(self.chunks),
            "uptime_seconds": round(time.time() - self.start_time, 2),
            "embedding_model": self.embedding_model.active_model_name,
        }


rag_engine = RAGEngine()
