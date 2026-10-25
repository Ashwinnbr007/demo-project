from pathlib import PurePosixPath
import pymupdf

SUPPORTED_EXTENSIONS = {".txt", ".md", ".pdf"}

def is_supported(object_name: str) -> bool:
    return PurePosixPath(object_name).suffix.lower() in SUPPORTED_EXTENSIONS

def load_document(object_name: str, data: bytes) -> list[dict]:
    """Return page/section records with text and source metadata from raw object bytes."""
    suffix = PurePosixPath(object_name).suffix.lower()
    records = []
    if suffix == ".pdf":
        with pymupdf.open(stream=data, filetype="pdf") as pdf:
            for page_index, page in enumerate(pdf):
                text = page.get_text("text").strip()
                if text:
                    records.append({
                        "text": text,
                        "metadata": {
                            "source": object_name,
                            "file_type": "pdf",
                            "page": page_index + 1,
                        },
                    })
    elif suffix in {".txt", ".md"}:
        text = data.decode("utf-8", errors="replace").strip()
        if text:
            records.append({
                "text": text,
                "metadata": {
                    "source": object_name,
                    "file_type": suffix.lstrip("."),
                    "page": None,
                },
            })
    else:
        raise ValueError(f"Unsupported file type: {suffix}")
    return records
