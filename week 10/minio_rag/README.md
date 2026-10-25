# MinIO + Qdrant RAG Pipeline (Python)

Documents live in a local MinIO bucket. `POST /ingest` pulls every supported object from the bucket, chunks it, embeds it locally, and stores the vectors in Qdrant. `POST /retrieve` embeds a query and returns the closest chunks. `POST /ask` retrieves chunks and has a local LLM (Ollama) write an answer from them, with citations.

## Stack
- MinIO: S3-compatible document store (bucket `documents`)
- Qdrant: vector database
- Sentence Transformers `all-MiniLM-L6-v2`: local embeddings (384 dims), no API key needed
- Ollama (`gemma4:26b` by default): local LLM for answer generation
- PyMuPDF: PDF text extraction
- FastAPI: HTTP API

## 1. Start MinIO and Qdrant

```bash
podman-compose up -d
```

- MinIO console: http://localhost:9001 (login `minioadmin` / `minioadmin`)
- Qdrant dashboard: http://localhost:6333/dashboard

The image comes from `quay.io/minio/minio`, because `minio/minio` can no longer be pulled from Docker Hub.

Ollama runs on the host (the Ollama.app), not in a container. On macOS that lets it use the Metal GPU, while a container would be CPU-only. Pull the model once:

```bash
ollama pull gemma4:26b    # or any chat model; set LLM_MODEL to match
```

## 2. Install

```bash
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 3. Put documents in MinIO

You can upload PDF, TXT or MD files through the MinIO console, or copy them into `documents/` and run:

```bash
python -m app.storage
```

## 4. Run the API

```bash
uvicorn app.api:app --reload
```

- Chat UI: http://127.0.0.1:8000
- Interactive API docs: http://127.0.0.1:8000/docs

### Chat UI

FastAPI serves the plain HTML, CSS and JS in `frontend/`, so there's no build step. The UI has:
- **Ask** mode, which calls `/ask`. The answer's `[n]` citations are clickable and jump to the matching source card.
- **Search only** mode, which calls `/retrieve` and shows the raw matching chunks with similarity scores.
- An **Ingest from MinIO** button in the sidebar, which calls `/ingest` with an optional prefix and shows the indexed files and chunk counts.
- A chat history kept in the browser's localStorage, plus Stop, Retry and Copy controls. Each question is answered on its own. Earlier turns are not sent to the model.

### Ingest everything in the bucket

```bash
curl -X POST localhost:8000/ingest -H 'Content-Type: application/json' -d '{}'
# only objects under a prefix:
curl -X POST localhost:8000/ingest -H 'Content-Type: application/json' -d '{"prefix": "reports/"}'
```

You can run ingestion as often as you like. Each object's old chunks are deleted before it is re-indexed. Unsupported file types are listed under `skipped`, and objects that fail to parse are listed under `failed`.

### Retrieve

```bash
curl -X POST localhost:8000/retrieve -H 'Content-Type: application/json' \
  -d '{"query": "what is a vector database?", "limit": 3}'
```

### Ask (retrieval + local LLM)

```bash
curl -X POST localhost:8000/ask -H 'Content-Type: application/json' \
  -d '{"query": "What is Qdrant and what does MinIO do?", "limit": 3}'
```

The response returns `answer`, which cites sources as `[1]`, `[2]`, and so on, and `sources`, which holds the retrieved chunks those numbers refer to. Thinking mode is turned off for speed.

## Layout
- `app/storage.py`: MinIO client, listing and reading objects, seed helper
- `app/document_loader.py`: turns object bytes into text records (PDF pages, TXT, MD)
- `app/chunking.py`: character-window chunker with overlap
- `app/embeddings.py`: sentence-transformers wrapper
- `app/vector_store.py`: Qdrant collection, upsert, delete-by-source
- `app/ingest.py`: bucket to chunks to vectors to Qdrant
- `app/retrieval.py`: similarity search
- `app/llm.py`: prompt building and the Ollama chat call
- `app/api.py`: the endpoints, plus serving the static frontend
- `frontend/`: the chat UI (`index.html`, `styles.css`, `app.js`)

Settings are read from environment variables (see `.env.example`). `.env` is not loaded automatically.
