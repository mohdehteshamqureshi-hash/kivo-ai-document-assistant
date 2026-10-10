import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


class Settings(BaseModel):
    APP_NAME: str = "Kivo AI RAG Engine"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = (
        "Enterprise-grade Retrieval-Augmented Generation (RAG) backend "
        "powered by pure NumPy Cosine Vector Search and page-level PDF citations."
    )
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))

    # CORS Configuration
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*"
    ]

    # Storage
    UPLOAD_PATH: Path = UPLOAD_DIR
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "25"))

    # RAG Chunking Parameters
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "350"))      # Words per chunk
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "50"))   # Words overlap
    TOP_K_RESULTS: int = int(os.getenv("TOP_K_RESULTS", "4"))
    MIN_SIMILARITY_SCORE: float = float(os.getenv("MIN_SIMILARITY_SCORE", "0.02"))

    # AI Provider: Groq API
    GROQ_API_KEY: str | None = os.getenv("GROQ_API_KEY", None)
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    # Optional External LLM Keys (Gemini or OpenAI)
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY", None)
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY", None)
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "auto")  # 'auto', 'groq', 'local', 'gemini', 'openai'


settings = Settings()
