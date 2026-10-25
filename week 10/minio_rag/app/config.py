import os
from dataclasses import dataclass

@dataclass(frozen=True)
class Settings:
    minio_endpoint: str = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    minio_access_key: str = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    minio_secret_key: str = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    minio_bucket: str = os.getenv("MINIO_BUCKET", "documents")
    minio_secure: bool = os.getenv("MINIO_SECURE", "false").lower() == "true"
    qdrant_url: str = os.getenv("QDRANT_URL", "http://localhost:6333")
    collection_name: str = os.getenv("COLLECTION_NAME", "minio_documents")
    embedding_model: str = os.getenv(
        "EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2"
    )
    chunk_size: int = int(os.getenv("CHUNK_SIZE", "900"))
    chunk_overlap: int = int(os.getenv("CHUNK_OVERLAP", "150"))
    ollama_url: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
    llm_model: str = os.getenv("LLM_MODEL", "gemma4:26b")
    llm_timeout: float = float(os.getenv("LLM_TIMEOUT", "300"))
    # Chunks scoring below this cosine similarity are treated as irrelevant and never sent to the LLM.
    min_score: float = float(os.getenv("MIN_SCORE", "0.18"))

settings = Settings()
