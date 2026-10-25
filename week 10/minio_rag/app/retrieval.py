from app.config import settings
from app.embeddings import embed_texts
from app.vector_store import ensure_collection, get_client

def search(query: str, limit: int = 5) -> list[dict]:
    if not query.strip():
        raise ValueError("query must not be empty")

    ensure_collection()
    response = get_client().query_points(
        collection_name=settings.collection_name,
        query=embed_texts([query])[0],
        limit=limit,
        with_payload=True,
        with_vectors=False,
    )
    results = []
    for point in response.points:
        payload = point.payload or {}
        results.append({
            "id": str(point.id),
            "score": point.score,
            "text": payload.get("text", ""),
            "metadata": {
                key: value for key, value in payload.items() if key != "text"
            },
        })
    return results
