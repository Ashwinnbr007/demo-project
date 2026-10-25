from pathlib import Path
from minio import Minio
from app.config import settings

_client: Minio | None = None

def get_client() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
    return _client

def ensure_bucket() -> None:
    client = get_client()
    if not client.bucket_exists(settings.minio_bucket):
        client.make_bucket(settings.minio_bucket)

def list_objects(prefix: str = "") -> list[str]:
    objects = get_client().list_objects(settings.minio_bucket, prefix=prefix, recursive=True)
    return sorted(obj.object_name for obj in objects if not obj.is_dir)

def read_object(object_name: str) -> bytes:
    response = get_client().get_object(settings.minio_bucket, object_name)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()

def upload_directory(directory: Path) -> list[str]:
    """Push every file in a local directory into the bucket (helper for seeding)."""
    ensure_bucket()
    uploaded = []
    for path in sorted(directory.rglob("*")):
        if path.is_file() and not path.name.startswith("."):
            object_name = path.relative_to(directory).as_posix()
            get_client().fput_object(settings.minio_bucket, object_name, str(path))
            uploaded.append(object_name)
    return uploaded

if __name__ == "__main__":
    for name in upload_directory(Path("./documents")):
        print(f"uploaded {name}")
