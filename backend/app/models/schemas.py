from typing import List, Optional
from pydantic import BaseModel, Field


class Citation(BaseModel):
    file: str = Field(..., description="Source document file name")
    page: int = Field(..., description="1-indexed page number in the original PDF")
    score: float = Field(..., description="Cosine similarity relevance score (0.0 to 1.0)")
    snippet: str = Field(..., description="Key context excerpt matching the query")


class DocumentMetadata(BaseModel):
    id: str = Field(..., description="Unique document ID (UUID)")
    name: str = Field(..., description="Original file name")
    pages: int = Field(..., description="Total pages extracted")
    chunks_count: int = Field(..., description="Number of text chunks generated")
    size_bytes: int = Field(..., description="File size in bytes")
    uploaded_at: str = Field(..., description="ISO 8601 upload timestamp")
    status: str = Field(default="ready", description="Processing state ('ready', 'processing', 'error')")


class ChunkMetadata(BaseModel):
    chunk_id: str
    doc_id: str
    doc_name: str
    page: int
    chunk_index: int
    text: str
    word_count: int


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Question to ask the knowledge base")
    top_k: Optional[int] = Field(default=4, ge=1, le=20, description="Number of top chunks to retrieve")
    doc_id: Optional[str] = Field(default=None, description="Optional document filter ID")


class QueryResponse(BaseModel):
    query: str
    answer: str
    answer_status: Optional[str] = "answered"
    citations: List[Citation]
    retrieved_passages: Optional[List[Citation]] = None
    retrieval_time_ms: float
    generation_time_ms: float
    total_time_ms: float
    confidence: float
    model_used: str


class HealthResponse(BaseModel):
    status: str
    version: str
    documents_count: int
    total_chunks: int
    vocabulary_size: int
    vector_engine: str
    llm_mode: str
    uptime_seconds: float


class DeleteResponse(BaseModel):
    success: bool
    message: str
    doc_id: Optional[str] = None
