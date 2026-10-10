import time
from typing import List, Optional
from fastapi import APIRouter, File, HTTPException, Query, UploadFile, status
from app.config import settings
from app.models.schemas import (
    ChunkMetadata,
    DeleteResponse,
    DocumentMetadata,
    HealthResponse,
    QueryRequest,
    QueryResponse,
)
from app.services.rag_service import rag_service

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="System Health & Index Diagnostics",
    tags=["Diagnostics"],
)
async def get_health():
    """Returns real-time health, active document counts, chunk inventory, and vector engine metrics."""
    stats = rag_service.get_stats()
    llm_mode = "Cloud (Gemini/OpenAI)" if (settings.GEMINI_API_KEY or settings.OPENAI_API_KEY) else "Local Grounded Synthesizer"

    return HealthResponse(
        status="healthy",
        version=settings.VERSION,
        documents_count=stats["documents_count"],
        total_chunks=stats["chunks_count"],
        vocabulary_size=stats["vocab_size"],
        vector_engine="NumPy Cosine Vector Space (TF-IDF)",
        llm_mode=llm_mode,
        uptime_seconds=stats["uptime_seconds"],
    )


@router.post(
    "/documents/upload",
    response_model=DocumentMetadata,
    status_code=status.HTTP_201_CREATED,
    summary="Upload & Index Document",
    tags=["Document Management"],
)
async def upload_document(file: UploadFile = File(...)):
    """
    Uploads a PDF or text document.
    Extracts text page-by-page using pypdf, partitions into overlapping chunks,
    and indexes chunks into the NumPy vector space.
    """
    filename = file.filename or "uploaded_document.pdf"
    ext = filename.lower().split(".")[-1]

    if ext not in ["pdf", "txt", "md"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type '.{ext}'. Supported formats: PDF, TXT, MD.",
        )

    content = await file.read()
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB}MB.",
        )

    try:
        doc_meta = rag_service.process_and_index_document(
            filename=filename,
            file_bytes=content,
            content_type=file.content_type or "application/pdf",
        )
        return doc_meta
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process document: {str(e)}",
        )


@router.get(
    "/documents",
    response_model=List[DocumentMetadata],
    summary="List Active Knowledge Base Documents",
    tags=["Document Management"],
)
async def list_documents():
    """Retrieves all indexed documents currently in the active knowledge base."""
    return rag_service.list_documents()


@router.get(
    "/documents/{doc_id}",
    response_model=DocumentMetadata,
    summary="Get Document Metadata",
    tags=["Document Management"],
)
async def get_document(doc_id: str):
    """Retrieves metadata for a specific document by ID."""
    doc = rag_service.get_document(doc_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{doc_id}' not found.",
        )
    return doc


@router.delete(
    "/documents/{doc_id}",
    response_model=DeleteResponse,
    summary="Delete Document",
    tags=["Document Management"],
)
async def delete_document(doc_id: str):
    """Removes a document and purges its vector embeddings from memory."""
    deleted = rag_service.delete_document(doc_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{doc_id}' not found.",
        )
    return DeleteResponse(
        success=True,
        message=f"Document '{doc_id}' successfully removed from knowledge base.",
        doc_id=doc_id,
    )


@router.delete(
    "/documents",
    response_model=DeleteResponse,
    summary="Clear Entire Knowledge Base",
    tags=["Document Management"],
)
async def clear_all_documents():
    """Removes all documents and resets the vector index."""
    rag_service.clear_all_documents()
    return DeleteResponse(
        success=True,
        message="All documents have been removed from memory. Knowledge base is clear.",
    )


@router.get(
    "/documents/{doc_id}/chunks",
    response_model=List[ChunkMetadata],
    summary="Inspect Document Chunks",
    tags=["Diagnostics"],
)
async def get_chunks(doc_id: str):
    """Inspects text chunks and page associations for a specific document."""
    chunks = rag_service.get_document_chunks(doc_id)
    if not chunks:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No chunks found for document '{doc_id}'.",
        )
    return chunks


@router.post(
    "/chat/query",
    response_model=QueryResponse,
    summary="Ask Question (RAG Grounded Q&A)",
    tags=["RAG Q&A"],
)
async def chat_query(req: QueryRequest):
    """
    Submits a user query to the RAG pipeline.
    Executes cosine vector retrieval, gathers source citations with page numbers,
    and returns a synthesized, grounded response with zero-hallucination protection.
    """
    if not req.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query cannot be empty.",
        )

    response = rag_service.execute_rag_query(req)
    return response


@router.get(
    "/stats",
    summary="Vector Engine Metrics",
    tags=["Diagnostics"],
)
async def get_metrics():
    """Returns internal NumPy matrix dimensions and engine stats."""
    return rag_service.get_stats()
