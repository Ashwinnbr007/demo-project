from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from app.config import settings
from app.ingest import ingest_bucket
from app.llm import NO_ANSWER, generate_answer
from app.retrieval import search

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"

app = FastAPI(title="MinIO + Qdrant RAG", version="1.0.0")

@app.get("/health")
def health():
    return {"status": "ok", "bucket": settings.minio_bucket, "model": settings.llm_model}

class IngestRequest(BaseModel):
    prefix: str = ""

class RetrieveRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    limit: int = Field(default=5, ge=1, le=20)

@app.post("/ingest")
def ingest(request: IngestRequest = IngestRequest()):
    try:
        return ingest_bucket(prefix=request.prefix)
    except Exception as exc:
        raise HTTPException(500, f"Ingestion failed: {exc}") from exc

@app.post("/retrieve")
def retrieve(request: RetrieveRequest):
    try:
        return {"query": request.query, "results": search(request.query, request.limit)}
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, f"Retrieval failed: {exc}") from exc

@app.post("/ask")
def ask(request: RetrieveRequest):
    try:
        chunks = search(request.query, request.limit)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    except Exception as exc:
        raise HTTPException(500, f"Retrieval failed: {exc}") from exc
    chunks = [chunk for chunk in chunks if chunk["score"] >= settings.min_score]
    if not chunks:
        # Refuse without calling the LLM so it has no chance to answer from its own knowledge.
        return {"query": request.query, "answer": NO_ANSWER, "sources": []}
    try:
        answer = generate_answer(request.query, chunks)
    except Exception as exc:
        raise HTTPException(502, f"LLM call failed (is Ollama running?): {exc}") from exc
    return {"query": request.query, "answer": answer, "sources": chunks}

# Mounted last so the API routes above take precedence over static files.
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
