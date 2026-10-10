import io
import re
import uuid
from typing import List, Tuple
from pypdf import PdfReader
from app.models.schemas import ChunkMetadata, DocumentMetadata
from app.config import settings


class DocumentService:
    @staticmethod
    def extract_text_from_pdf(file_bytes: bytes) -> List[Tuple[int, str]]:
        """
        Extracts text from PDF bytes page by page.
        Returns a list of tuples: (page_number_1_indexed, text_content).
        Falls back to UTF-8 decoding if stream is not a standard binary PDF.
        """
        try:
            reader = PdfReader(io.BytesIO(file_bytes))
            extracted_pages: List[Tuple[int, str]] = []

            for idx, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                cleaned_text = DocumentService._clean_text(page_text)
                if cleaned_text.strip():
                    extracted_pages.append((idx + 1, cleaned_text))

            if extracted_pages:
                return extracted_pages
        except Exception as e:
            # Fall back to text extraction if PDF is plain text or slightly malformed
            pass

        return DocumentService.extract_text_from_txt(file_bytes)

    @staticmethod
    def extract_text_from_txt(file_bytes: bytes) -> List[Tuple[int, str]]:
        """Extracts text from plain text or markdown files."""
        try:
            content = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            content = file_bytes.decode("latin-1", errors="ignore")

        cleaned = DocumentService._clean_text(content)
        return [(1, cleaned)]

    @staticmethod
    def _clean_text(text: str) -> str:
        """Removes abnormal characters and normalizes whitespace."""
        text = re.sub(r"[\x00-\x08\x0b-\x0c\x0e-\x1f]", " ", text)
        text = re.sub(r"\r\n|\r", "\n", text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    @staticmethod
    def chunk_document(
        doc_id: str,
        doc_name: str,
        pages_data: List[Tuple[int, str]],
        chunk_size: int = settings.CHUNK_SIZE,
        chunk_overlap: int = settings.CHUNK_OVERLAP,
    ) -> List[ChunkMetadata]:
        """
        Splits document pages into semantic chunks with sliding overlap.
        Preserves the source page number for exact academic citation.
        """
        chunks: List[ChunkMetadata] = []
        global_chunk_idx = 0

        for page_num, page_text in pages_data:
            words = page_text.split()
            if not words:
                continue

            # If page is smaller than chunk_size, treat entire page as 1 chunk
            if len(words) <= chunk_size:
                chunk = ChunkMetadata(
                    chunk_id=f"{doc_id}_c{global_chunk_idx}",
                    doc_id=doc_id,
                    doc_name=doc_name,
                    page=page_num,
                    chunk_index=global_chunk_idx,
                    text=" ".join(words),
                    word_count=len(words),
                )
                chunks.append(chunk)
                global_chunk_idx += 1
                continue

            # Sliding window over page words
            step = max(1, chunk_size - chunk_overlap)
            for start_idx in range(0, len(words), step):
                chunk_words = words[start_idx : start_idx + chunk_size]
                if not chunk_words:
                    break

                chunk_text = " ".join(chunk_words)
                chunk = ChunkMetadata(
                    chunk_id=f"{doc_id}_c{global_chunk_idx}",
                    doc_id=doc_id,
                    doc_name=doc_name,
                    page=page_num,
                    chunk_index=global_chunk_idx,
                    text=chunk_text,
                    word_count=len(chunk_words),
                )
                chunks.append(chunk)
                global_chunk_idx += 1

                # If reached end of words, stop
                if start_idx + chunk_size >= len(words):
                    break

        return chunks
