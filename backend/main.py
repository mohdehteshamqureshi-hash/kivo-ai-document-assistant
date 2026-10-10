import time
from typing import List, Optional
from fastapi import FastAPI, File, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from config import settings
from llm_service import LLMService, DISCLAIMER_TEXT
from rag_engine import rag_engine
from schemas import (
    ChatRequest,
    ChatResponse,
    Citation,
    DeleteResponse,
    DocumentMetadata,
    HealthResponse,
)

app = FastAPI(
    title="Kivo AI Backend",
    version=settings.APP_VERSION,
    description="""
## Kivo AI — Intelligent RAG-Based Document Assistant
High-performance RAG backend providing:
- Page-level PDF extraction with `pypdf`
- Sentence embeddings (`sentence-transformers/all-MiniLM-L6-v2`)
- Normalized NumPy cosine vector similarity retrieval
- Grounded Q&A with untrusted input containment and zero hallucination
    """,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handler to avoid exposing stack traces to clients
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": f"An error occurred while processing the request: {str(exc)}"},
    )


# -----------------------------------------------------------------------------
# 1. GET /health — System Health & Diagnostics
# -----------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse, tags=["Diagnostics"])
@app.get("/api/health", response_model=HealthResponse, include_in_schema=False)
async def get_health():
    """Returns backend status, embedding model, and in-memory index counts."""
    diag = rag_engine.get_diagnostics()
    ollama_stat = LLMService.check_ollama_status()
    if ollama_stat["available"]:
        llm_mode = f"Local LLM (Ollama {settings.OLLAMA_MODEL})"
    elif settings.GEMINI_API_KEY or settings.OPENAI_API_KEY:
        llm_mode = "Cloud (Gemini/OpenAI)"
    else:
        llm_mode = f"Fallback Rule Synthesizer (Ollama offline at {settings.OLLAMA_BASE_URL})"

    return HealthResponse(
        status="healthy",
        version=settings.APP_VERSION,
        embedding_model=diag["embedding_model"],
        documents_count=diag["documents_count"],
        total_chunks=diag["chunks_count"],
        vocabulary_size=diag.get("vocabulary_size", 384),
        vector_engine="NumPy Cosine Vector Space (Normalized)",
        llm_mode=llm_mode,
        uptime_seconds=diag["uptime_seconds"],
    )


# -----------------------------------------------------------------------------
# 2. POST /documents — PDF Upload, Text Extraction & Embedding Indexing
# -----------------------------------------------------------------------------
@app.post(
    "/documents",
    response_model=DocumentMetadata,
    status_code=status.HTTP_201_CREATED,
    tags=["Documents"],
)
@app.post(
    "/documents/upload",
    response_model=DocumentMetadata,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
@app.post(
    "/api/documents/upload",
    response_model=DocumentMetadata,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
@app.post(
    "/api/documents",
    response_model=DocumentMetadata,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def upload_document(file: UploadFile = File(...)):
    """
    Accepts a PDF document upload:
    - Validates file type and size (<= 25 MB)
    - Extracts text page by page with pypdf
    - Partitions text into overlapping sliding-window passages
    - Generates normalized sentence embeddings
    - Indexes chunks into memory
    """
    filename = file.filename or "uploaded_document.pdf"

    # 1. Validate file extension
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Only PDF files are supported for page-level extraction.",
        )

    # 2. Validate file size
    file_bytes = await file.read()
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_FILE_SIZE_MB} MB.",
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded PDF file is empty (0 bytes).",
        )

    # 3. Process and index PDF
    try:
        doc_meta = rag_engine.add_document(filename=filename, file_bytes=file_bytes)
        return doc_meta
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(val_err),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process and index PDF: {str(e)}",
        )


# -----------------------------------------------------------------------------
# 3. GET /documents — List Uploaded Documents
# -----------------------------------------------------------------------------
@app.get("/documents", response_model=List[DocumentMetadata], tags=["Documents"])
@app.get("/api/documents", response_model=List[DocumentMetadata], include_in_schema=False)
async def list_documents():
    """Lists all active indexed documents and their processing status."""
    return rag_engine.list_documents()


# -----------------------------------------------------------------------------
# 4. POST /chat — Grounded RAG Q&A with Verified Citations
# -----------------------------------------------------------------------------
@app.post("/chat", response_model=ChatResponse, tags=["RAG Chat"])
@app.post("/chat/query", response_model=ChatResponse, include_in_schema=False)
@app.post("/api/chat/query", response_model=ChatResponse, include_in_schema=False)
@app.post("/api/chat", response_model=ChatResponse, include_in_schema=False)
async def chat_query(req: ChatRequest):
    """
    Accepts a question and optional document IDs:
    - Retrieves top relevant chunks using NumPy cosine similarity
    - Passes chunks to LLM service under strict untrusted-context containment
    - Returns answer with page-level source citations and disclaimer
    """
    question_text = req.get_query_text()
    if not question_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question text cannot be empty.",
        )

    total_start = time.perf_counter()

    # Step 1: Semantic Retrieval via NumPy Cosine Similarity
    retrieval_start = time.perf_counter()
    top_chunks = rag_engine.search_chunks(
        query=question_text,
        top_k=req.top_k or settings.TOP_K_CHUNKS,
        document_ids=req.get_target_doc_ids(),
        min_similarity=settings.SIMILARITY_THRESHOLD,
    )
    retrieval_time_ms = round((time.perf_counter() - retrieval_start) * 1000, 2)

    # Step 2: Build Citations
    citations: List[Citation] = []
    for chunk, score in top_chunks:
        snippet = chunk.chunk_text.strip().replace("\n", " ")
        if len(snippet) > 200:
            snippet = snippet[:200] + "..."

        citations.append(
            Citation(
                file=chunk.filename,
                page=chunk.page_number,
                score=round(score, 4),
                snippet=snippet,
            )
        )

    # Step 3: Grounded Answer Synthesis
    gen_start = time.perf_counter()
    answer, model_used = LLMService.generate_grounded_answer(
        question=question_text, retrieved_chunks=top_chunks
    )
    generation_time_ms = round((time.perf_counter() - gen_start) * 1000, 2)
    total_time_ms = round((time.perf_counter() - total_start) * 1000, 2)

    confidence = round(top_chunks[0][1], 4) if top_chunks else 0.0

    return ChatResponse(
        question=question_text,
        query=question_text,
        answer=answer,
        citations=citations,
        retrieval_time_ms=retrieval_time_ms,
        generation_time_ms=generation_time_ms,
        total_time_ms=total_time_ms,
        confidence=confidence,
        model_used=model_used,
        disclaimer=DISCLAIMER_TEXT,
    )


# -----------------------------------------------------------------------------
# 5. DELETE /documents/{document_id} — Delete Document and Purge Chunks
# -----------------------------------------------------------------------------
@app.delete(
    "/documents/{document_id}", response_model=DeleteResponse, tags=["Documents"]
)
@app.delete(
    "/api/documents/{document_id}", response_model=DeleteResponse, include_in_schema=False
)
async def delete_document(document_id: str):
    """Removes the selected document and purges its indexed chunk vectors from memory."""
    deleted = rag_engine.delete_document(document_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document with ID '{document_id}' was not found.",
        )
    return DeleteResponse(
        success=True,
        message=f"Document '{document_id}' and all associated vector chunks were successfully removed.",
        document_id=document_id,
        doc_id=document_id,
    )


# Extra convenience endpoint for clearing all documents
@app.delete("/documents", response_model=DeleteResponse, tags=["Documents"])
@app.delete("/api/documents", response_model=DeleteResponse, include_in_schema=False)
async def clear_all_documents():
    """Clears all indexed documents from the active knowledge base."""
    rag_engine.clear_all()
    return DeleteResponse(
        success=True,
        message="Knowledge base cleared. All in-memory documents removed.",
        document_id=None,
        doc_id=None,
    )


@app.get("/", tags=["Root"])
async def root():
    """Root status endpoint with interactive Swagger docs link."""
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs_url": "/docs",
        "endpoints": {
            "health": "/health",
            "upload_document": "POST /documents",
            "list_documents": "GET /documents",
            "chat_rag": "POST /chat",
            "delete_document": "DELETE /documents/{document_id}",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
