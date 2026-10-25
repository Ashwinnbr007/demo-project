from qdrant_client import QdrantClient, models
from app.config import settings
from app.embeddings import embedding_dimension

_client: QdrantClient | None = None

def get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(url=settings.qdrant_url)
    return _client

def ensure_collection() -> None:
    client = get_client()
    if not client.collection_exists(settings.collection_name):
        client.create_collection(
            collection_name=settings.collection_name,
            vectors_config=models.VectorParams(
                size=embedding_dimension(),
                distance=models.Distance.COSINE,
            ),
        )
        client.create_payload_index(
            collection_name=settings.collection_name,
            field_name="source",
            field_schema=models.PayloadSchemaType.KEYWORD,
        )

def delete_by_source(source: str) -> None:
    get_client().delete(
        collection_name=settings.collection_name,
        points_selector=models.FilterSelector(
            filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="source",
                        match=models.MatchValue(value=source),
                    )
                ]
            )
        ),
        wait=True,
    )

def upsert_chunks(chunks: list[dict]) -> int:
    if not chunks:
        return 0
    get_client().upsert(
        collection_name=settings.collection_name,
        points=[
            models.PointStruct(
                id=item["id"],
                vector=item["vector"],
                payload=item["payload"],
            )
            for item in chunks
        ],
        wait=True,
    )
    return len(chunks)
