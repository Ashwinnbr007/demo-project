from uuid import uuid5, NAMESPACE_URL
from app.config import settings
from app.chunking import chunk_text
from app.document_loader import load_document, is_supported
from app.embeddings import embed_texts
from app.storage import ensure_bucket, list_objects, read_object
from app.vector_store import ensure_collection, delete_by_source, upsert_chunks

def ingest_object(object_name: str) -> dict:
    pages = load_document(object_name, read_object(object_name))
    pieces = []
    for record in pages:
        for chunk_index, chunk in enumerate(
            chunk_text(record["text"], settings.chunk_size, settings.chunk_overlap)
        ):
            metadata = dict(record["metadata"])
            metadata["chunk_index"] = chunk_index
            pieces.append({"text": chunk, "metadata": metadata})

    # Replace this object's previous chunks so re-ingestion doesn't leave stale records.
    delete_by_source(object_name)

    vectors = embed_texts([item["text"] for item in pieces])
    points = []
    for item, vector in zip(pieces, vectors):
        metadata = item["metadata"]
        stable_key = f'{settings.minio_bucket}/{object_name}::{metadata.get("page")}::{metadata["chunk_index"]}'
        points.append({
            "id": str(uuid5(NAMESPACE_URL, stable_key)),
            "vector": vector,
            "payload": {"text": item["text"], **metadata},
        })
    return {"object": object_name, "chunks_indexed": upsert_chunks(points)}

def ingest_bucket(prefix: str = "") -> dict:
    """Ingest every supported document in the MinIO bucket (optionally under a prefix)."""
    ensure_bucket()
    ensure_collection()
    ingested, skipped, failed = [], [], []
    for object_name in list_objects(prefix):
        if not is_supported(object_name):
            skipped.append(object_name)
            continue
        try:
            ingested.append(ingest_object(object_name))
        except Exception as exc:
            failed.append({"object": object_name, "error": str(exc)})
    return {
        "bucket": settings.minio_bucket,
        "ingested": ingested,
        "skipped": skipped,
        "failed": failed,
    }
