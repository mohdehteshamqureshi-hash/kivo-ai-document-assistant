import time
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional
from app.config import settings
from app.models.schemas import (
    Citation,
    ChunkMetadata,
    DocumentMetadata,
    QueryRequest,
    QueryResponse,
)
from app.services.document_service import DocumentService
from app.services.vector_engine import NumpyVectorEngine
from app.services.llm_service import LLMService


class RAGService:
    """
    Central Coordinator managing document lifecycle, indexing,
    vector retrieval, and LLM-grounded response generation.
    """

    def __init__(self):
        self.documents: Dict[str, DocumentMetadata] = {}
        self.vector_engine = NumpyVectorEngine()
        self.start_time = time.time()

    def process_and_index_document(
        self, filename: str, file_bytes: bytes, content_type: str = "application/pdf"
    ) -> DocumentMetadata:
        """
        Parses document, extracts pages, generates sliding-window chunks,
        and indexes them into the NumPy Vector Engine.
        """
        doc_id = str(uuid.uuid4())[:8]

        # 1. Page-aware Text Extraction
        if filename.lower().endswith(".pdf") or "pdf" in content_type.lower():
            pages_data = DocumentService.extract_text_from_pdf(file_bytes)
        else:
            pages_data = DocumentService.extract_text_from_txt(file_bytes)

        # 2. Chunking with strict page preservation
        chunks = DocumentService.chunk_document(
            doc_id=doc_id,
            doc_name=filename,
            pages_data=pages_data,
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
        )

        # 3. Vector Indexing with NumPy
        self.vector_engine.add_chunks(chunks)

        # 4. Save Metadata
        meta = DocumentMetadata(
            id=doc_id,
            name=filename,
            pages=len(pages_data),
            chunks_count=len(chunks),
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
        """Retrieves metadata for a specific document."""
        return self.documents.get(doc_id)

    def delete_document(self, doc_id: str) -> bool:
        """Deletes document and removes associated vectors from index."""
        if doc_id in self.documents:
            del self.documents[doc_id]
            self.vector_engine.remove_document(doc_id)
            return True
        return False

    def clear_all_documents(self) -> None:
        """Wipes all documents and index."""
        self.documents.clear()
        self.vector_engine.clear()

    def get_document_chunks(self, doc_id: str) -> List[ChunkMetadata]:
        """Returns chunks for a specific document (useful for inspection/debugging)."""
        return [c for c in self.vector_engine.chunks if c.doc_id == doc_id]

    def execute_rag_query(self, req: QueryRequest) -> QueryResponse:
        """
        End-to-end RAG pipeline:
        1. Retrieval via NumPy Cosine Similarity.
        2. Citations assembly with exact PDF page metadata.
        3. LLM generation with Zero-Hallucination Guard.
        """
        total_start = time.perf_counter()

        # Step 1: Retrieval
        retrieval_start = time.perf_counter()
        top_k = req.top_k or settings.TOP_K_RESULTS
        retrieved = self.vector_engine.search(
            query=req.query,
            top_k=top_k,
            doc_id_filter=req.doc_id,
            min_similarity=settings.MIN_SIMILARITY_SCORE,
        )
        retrieval_time_ms = round((time.perf_counter() - retrieval_start) * 1000, 2)

        # Step 2: Build Citations
        citations: List[Citation] = []
        for chunk, score in retrieved:
            # Extract snippet for preview (first 180 chars clean)
            snippet = chunk.text.strip().replace("\n", " ")
            if len(snippet) > 180:
                snippet = snippet[:180] + "..."

            citations.append(
                Citation(
                    file=chunk.doc_name,
                    page=chunk.page,
                    score=round(score, 4),
                    snippet=snippet,
                )
            )

        # Step 3: Synthesis / LLM Generation
        gen_start = time.perf_counter()
        answer, model_used = LLMService.generate_answer(
            query=req.query, retrieved_chunks=retrieved
        )
        generation_time_ms = round((time.perf_counter() - gen_start) * 1000, 2)

        total_time_ms = round((time.perf_counter() - total_start) * 1000, 2)
        lower_ans = answer.lower()
        is_refusal = (
            model_used == "zero-hallucination-guard"
            or "no relevant passages were found" in lower_ans
            or "not contain sufficient" in lower_ans
            or "cannot answer" in lower_ans
            or "insufficient information" in lower_ans
            or "supplied document does not" in lower_ans
            or "provided document does not" in lower_ans
            or "does not mention" in lower_ans
            or "does not explicitly mention" in lower_ans
        )
        answer_status = "insufficient_information" if is_refusal else "answered"
        final_citations = [] if is_refusal else citations
        confidence = 0.0 if (is_refusal or not retrieved) else round(retrieved[0][1], 4)

        return QueryResponse(
            query=req.query,
            answer=answer,
            answer_status=answer_status,
            citations=final_citations,
            retrieved_passages=citations,
            retrieval_time_ms=retrieval_time_ms,
            generation_time_ms=generation_time_ms,
            total_time_ms=total_time_ms,
            confidence=confidence,
            model_used=model_used,
        )

    def get_stats(self) -> dict:
        """Returns runtime and indexing diagnostics."""
        return {
            "documents_count": len(self.documents),
            "chunks_count": len(self.vector_engine.chunks),
            "vocab_size": len(self.vector_engine.vocab),
            "uptime_seconds": round(time.time() - self.start_time, 2),
            "matrix_shape": list(self.vector_engine.chunk_matrix.shape),
        }


# Singleton RAG Service Instance
rag_service = RAGService()
