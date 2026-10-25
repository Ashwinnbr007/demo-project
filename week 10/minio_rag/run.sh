# Start MinIO + Qdrant
podman-compose up -d

# Create a virtual environment
python3.11 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Optional: put PDF/TXT/MD files into documents/ and push them to the MinIO bucket
python -m app.storage

# Start the API, then POST /ingest and POST /retrieve
uvicorn app.api:app --reload
