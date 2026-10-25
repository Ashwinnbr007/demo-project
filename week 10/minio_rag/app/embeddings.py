from functools import lru_cache
from sentence_transformers import SentenceTransformer
from app.config import settings

@lru_cache(maxsize=1)
def get_model() -> SentenceTransformer:
    # Downloads the model on first run, then loads it from the local cache.
    return SentenceTransformer(settings.embedding_model)

def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    vectors = get_model().encode(
        texts,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return vectors.tolist()

def embedding_dimension() -> int:
    return int(get_model().get_sentence_embedding_dimension())
