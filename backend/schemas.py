from typing import List, Optional
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(..., description="System health status (e.g. 'healthy')")
    version: str = Field(..., description="API version")
    embedding_model: str = Field(..., description="Active embedding model or fallback name")
    documents_count: int = Field(..., description="Number of documents currently indexed")
    total_chunks: int = Field(..., description="Total passage chunks in vector memory")
    vocabulary_size: int = Field(default=0, description="Estimated vocabulary terms or feature dimensions")
    vector_engine: str = Field(default="NumPy Cosine Vector Space", description="Vector retrieval engine")
    llm_mode: str = Field(default="Local Grounded Synthesizer", description="Active generation mode")
    uptime_seconds: float = Field(..., description="Server uptime in seconds")


class DocumentMetadata(BaseModel):
    id: str = Field(..., description="Unique document ID")
    name: str = Field(..., description="Document file name")
    pages: int = Field(..., description="Number of pages extracted")
    chunks_count: int = Field(..., description="Number of text chunks created")
    size_bytes: int = Field(..., description="File size in bytes")
    uploaded_at: str = Field(..., description="ISO 8601 upload timestamp")
    status: str = Field(default="ready", description="Processing state ('ready', 'processing', 'error')")


class Citation(BaseModel):
    file: str = Field(..., description="Source document filename")
    page: int = Field(..., description="1-indexed source PDF page number")
    score: float = Field(..., description="Cosine similarity relevance score (0.0 to 1.0)")
    snippet: str = Field(..., description="Excerpt snippet from the source passage")


class ChatRequest(BaseModel):
    question: Optional[str] = Field(default=None, description="User question to answer from context")
    query: Optional[str] = Field(default=None, description="Alias for question")
    document_ids: Optional[List[str]] = Field(default=None, description="Optional list of document IDs to scope search")
    doc_id: Optional[str] = Field(default=None, description="Optional single document ID to scope search")
    top_k: Optional[int] = Field(default=4, ge=1, le=20, description="Number of top chunks to retrieve")

    def get_query_text(self) -> str:
        """Returns the question text from either question or query field."""
        text = self.question or self.query or ""
        return text.strip()

    def get_target_doc_ids(self) -> Optional[List[str]]:
        """Returns target document IDs if provided."""
        if self.document_ids:
            return self.document_ids
        if self.doc_id:
            return [self.doc_id]
        return None


class ChatResponse(BaseModel):
    question: str
    query: Optional[str] = None
    answer: str
    answer_status: Optional[str] = "answered"
    citations: List[Citation]
    retrieved_passages: Optional[List[Citation]] = None
    retrieval_time_ms: float
    generation_time_ms: float
    total_time_ms: float
    confidence: float
    model_used: str
    disclaimer: str = (
        "Citations identify the source passage locations but do not guarantee factual correctness of the source text."
    )


class DeleteResponse(BaseModel):
    success: bool
    message: str
    document_id: Optional[str] = None
    doc_id: Optional[str] = None
