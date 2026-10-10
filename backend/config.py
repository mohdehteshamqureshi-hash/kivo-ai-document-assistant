import os
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent

class Settings:
    """Application configuration loaded from environment variables."""
    APP_NAME: str = os.getenv("APP_NAME", "Kivo AI")
    APP_VERSION: str = "1.0.0"
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,*").split(",")
        if origin.strip()
    ]

    # RAG & Embedding Model Configuration
    EMBEDDING_MODEL_NAME: str = os.getenv(
        "EMBEDDING_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2"
    )
    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "350"))          # Words per chunk
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "50"))       # Overlapping words
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "25"))
    TOP_K_CHUNKS: int = int(os.getenv("TOP_K_CHUNKS", "4"))
    SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.10"))

    # Local LLM Runtime (Ollama)
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    OLLAMA_TIMEOUT_SECONDS: int = int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "30"))

    # AI Provider: Groq API
    GROQ_API_KEY: str | None = os.getenv("GROQ_API_KEY", None)
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    # Optional Cloud LLM API Keys
    GEMINI_API_KEY: str | None = os.getenv("GEMINI_API_KEY", None)
    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY", None)

settings = Settings()
