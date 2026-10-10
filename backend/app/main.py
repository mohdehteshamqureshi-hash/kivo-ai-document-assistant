from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.routes import router as api_router
from app.config import settings
from app.services.rag_service import rag_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle events on startup and shutdown."""
    print("=" * 60)
    print(f"🚀 Starting {settings.APP_NAME} v{settings.VERSION}")
    print(f"📡 Vector Engine: Pure NumPy Cosine Vector Space Model")
    print(f"🌐 Server URL: http://{settings.HOST}:{settings.PORT}")
    print(f"📚 Interactive Swagger Docs: http://{settings.HOST}:{settings.PORT}/docs")
    print("=" * 60)

    # Initialize a sample starter document if knowledge base is empty
    starter_content = (
        "Artificial Intelligence Ethics and Safety Standard Guide\n\n"
        "Section 1: Core Principles.\n"
        "AI systems must be transparent, accountable, and grounded in verifiable empirical data.\n"
        "Models should minimize algorithmic bias and respect user privacy at all stages.\n\n"
        "Section 2: Retrieval-Augmented Generation Architecture.\n"
        "RAG couples an information retrieval component with an answer generation module.\n"
        "By grounding model responses directly in authoritative source documents, RAG eliminates "
        "hallucinations and ensures verifiable citations for every factual claim.\n\n"
        "Section 3.2: Verification and Data Provenance.\n"
        "According to Section 3.2 of the guide, the system maintains strict alignment and data "
        "provenance standards through mathematical cosine similarity measurement and page-level provenance."
    )
    rag_service.process_and_index_document(
        filename="Sample_AI_Ethics_Guide.pdf",
        file_bytes=starter_content.encode("utf-8"),
        content_type="text/plain",
    )
    print("✅ Seed knowledge document indexed: 'Sample_AI_Ethics_Guide.pdf'")

    yield

    print("🛑 Shutting down Kivo AI Backend...")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="""
## 🤖 Kivo AI - RAG Document Assistant API

A high-performance **Retrieval-Augmented Generation (RAG)** backend designed for document Q&A and semantic knowledge interrogation.

### 🌟 Features:
- **NumPy Cosine Vector Search**: Vector space retrieval computed with pure NumPy dot products and L2 normalization.
- **Page-Level Grounding**: Every retrieved chunk preserves original PDF page numbers for zero hallucination.
- **Dual-Mode Generation**: Built-in offline grounded synthesis + optional Google Gemini / OpenAI cloud integration.
- **RESTful Endpoints**: Full lifecycle management for document uploads, deletions, and real-time Q&A.
    """,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routes
app.include_router(api_router, prefix="/api")


@app.get("/", tags=["Root"])
async def root():
    """Welcome route with links to documentation and system status."""
    return {
        "project": settings.APP_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs_url": "/docs",
        "endpoints": {
            "health": "/api/health",
            "documents": "/api/documents",
            "upload": "/api/documents/upload",
            "chat": "/api/chat/query",
            "stats": "/api/stats",
        },
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "detail": str(exc),
            "path": str(request.url),
        },
    )
