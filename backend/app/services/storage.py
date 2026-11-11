"""Private object storage for children's recordings and handwriting images.

Objects are written once under content-addressed keys and are never served publicly:
reads go through short-lived signed URLs (S3 presign, or a signed token for the local backend).
"""

import hashlib
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Protocol

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.security import file_token

AUDIO_TYPES = {"wav": "audio/wav", "m4a": "audio/mp4", "mp4": "audio/mp4", "aac": "audio/aac", "webm": "audio/webm"}
IMAGE_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


@dataclass
class StoredUpload:
    path: str  # temp file on disk
    sha256: str
    md5: str
    size: int
    ext: str
    mime: str


def sniff_type(head: bytes) -> tuple[str, str] | None:
    """Identify a file from its first bytes. Extensions and client MIME types are not trusted."""
    if head.startswith(b"RIFF") and head[8:12] == b"WAVE":
        return "wav", "audio/wav"
    if head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return "webp", "image/webp"
    if head[4:8] == b"ftyp":
        return "m4a", "audio/mp4"
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return "webm", "audio/webm"
    if head.startswith(b"\xff\xf1") or head.startswith(b"\xff\xf9"):
        return "aac", "audio/aac"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg", "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png", "image/png"
    return None


def spool_upload(src: BinaryIO, kind: str) -> StoredUpload:
    """Stream an upload to a temp file while hashing it; enforce size and type limits."""
    s = get_settings()
    limit = (s.max_audio_mb if kind == "audio" else s.max_image_mb) * 1024 * 1024
    allowed = AUDIO_TYPES if kind == "audio" else IMAGE_TYPES
    sha = hashlib.sha256()
    md5 = hashlib.md5(usedforsecurity=False)
    size = 0
    head = b""
    fd, path = tempfile.mkstemp(prefix="vgyan-up-")
    try:
        with os.fdopen(fd, "wb") as out:
            while chunk := src.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise ApiError(413, "file_too_large", f"File exceeds {limit // (1024 * 1024)} MB")
                if len(head) < 16:
                    head += chunk[: 16 - len(head)]
                sha.update(chunk)
                md5.update(chunk)
                out.write(chunk)
        if size == 0:
            raise ApiError(422, "empty_file", "Uploaded file is empty")
        sniffed = sniff_type(head)
        if not sniffed or sniffed[0] not in allowed:
            raise ApiError(415, "unsupported_media", f"Unsupported {kind} format")
        return StoredUpload(path, sha.hexdigest(), md5.hexdigest(), size, sniffed[0], sniffed[1])
    except Exception:
        Path(path).unlink(missing_ok=True)
        raise


class Storage(Protocol):
    def put_file(self, key: str, path: str, mime: str) -> None: ...
    def exists(self, key: str) -> bool: ...
    def get_bytes(self, key: str) -> bytes: ...
    def signed_url(self, key: str, ttl: int) -> str: ...
    def delete(self, key: str) -> None: ...
    def ping(self) -> None: ...


class LocalStorage:
    """Development backend: files under LOCAL_STORAGE_DIR, served via /files/{signed token}."""

    def __init__(self, root: str):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = (self.root / key).resolve()
        if self.root not in p.parents:
            raise ApiError(400, "bad_key", "Invalid object key")
        return p

    def put_file(self, key: str, path: str, mime: str) -> None:
        dest = self._path(key)
        if dest.exists():
            return  # content-addressed: same key means same bytes
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix(dest.suffix + ".part")
        with open(path, "rb") as src, open(tmp, "wb") as out:
            while chunk := src.read(1024 * 1024):
                out.write(chunk)
        tmp.replace(dest)

    def exists(self, key: str) -> bool:
        return self._path(key).exists()

    def get_bytes(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    def signed_url(self, key: str, ttl: int) -> str:
        base = get_settings().public_base_url.rstrip("/")
        return f"{base}/files/{file_token(key, ttl)}"

    def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    def ping(self) -> None:
        if not self.root.is_dir():
            raise RuntimeError("storage directory missing")


class S3Storage:
    """Any S3-compatible private bucket (AWS S3, Cloudflare R2, Backblaze B2, MinIO)."""

    def __init__(self) -> None:
        import boto3
        from botocore.config import Config

        s = get_settings()
        self.bucket = s.s3_bucket
        self.client = boto3.client(
            "s3",
            endpoint_url=s.s3_endpoint_url or None,
            region_name=s.s3_region,
            aws_access_key_id=s.s3_access_key_id,
            aws_secret_access_key=s.s3_secret_access_key,
            config=Config(signature_version="s3v4", retries={"max_attempts": 5, "mode": "standard"}),
        )

    def put_file(self, key: str, path: str, mime: str) -> None:
        if self.exists(key):
            return
        extra = {"ContentType": mime, "ServerSideEncryption": "AES256"}
        try:
            self.client.upload_file(path, self.bucket, key, ExtraArgs=extra)
        except Exception:
            # R2 and some S3-compatible stores reject the SSE header (they encrypt at rest anyway).
            self.client.upload_file(path, self.bucket, key, ExtraArgs={"ContentType": mime})

    def exists(self, key: str) -> bool:
        from botocore.exceptions import ClientError

        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                return False
            raise

    def get_bytes(self, key: str) -> bytes:
        return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def signed_url(self, key: str, ttl: int) -> str:
        return self.client.generate_presigned_url("get_object", Params={"Bucket": self.bucket, "Key": key}, ExpiresIn=ttl)

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def ping(self) -> None:
        self.client.head_bucket(Bucket=self.bucket)


_storage: Storage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        s = get_settings()
        _storage = S3Storage() if s.storage_backend == "s3" else LocalStorage(s.local_storage_dir)
    return _storage


def reset_storage() -> None:
    global _storage
    _storage = None


def media_key(kind: str, participant_id: str, attempt_id: str, sha256: str, ext: str) -> str:
    # Participant ID only (never names); content hash makes every object write-once.
    return f"{kind}/{participant_id}/{attempt_id}/{sha256}.{ext}"
