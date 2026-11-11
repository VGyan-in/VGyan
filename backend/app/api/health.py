import jwt
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import __version__
from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.security import decode_file_token
from app.db import get_db
from app.services import gemini
from app.services.storage import AUDIO_TYPES, IMAGE_TYPES, LocalStorage, get_storage

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    """Liveness: the process is up."""
    return {"status": "ok", "version": __version__}


@router.get("/health/ready")
def ready(db: Session = Depends(get_db, scope="function")):
    """Readiness: database and object storage reachable. Reports (not fails on) optional AI/OCR config."""
    checks = {}
    ok = True
    try:
        db.execute(text("SELECT 1"))
        rev = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
        checks["database"] = {"ok": True, "migration": rev}
    except Exception as e:
        ok = False
        checks["database"] = {"ok": False, "error": type(e).__name__}
    try:
        get_storage().ping()
        checks["storage"] = {"ok": True, "backend": get_settings().storage_backend}
    except Exception as e:
        ok = False
        checks["storage"] = {"ok": False, "error": type(e).__name__}
    checks["ai"] = {"configured": gemini.is_configured(), "model": get_settings().gemini_model}
    checks["ocr"] = {"provider": get_settings().ocr_provider}
    return JSONResponse(
        status_code=200 if ok else 503, content={"status": "ok" if ok else "degraded", "checks": checks, "version": __version__}
    )


@router.get("/files/{token}", include_in_schema=False)
def local_file(token: str):
    """Serves an object for the local storage backend via a short-lived signed token."""
    storage = get_storage()
    if not isinstance(storage, LocalStorage):
        raise ApiError(404, "not_found", "Not found")
    try:
        key = decode_file_token(token)
    except jwt.PyJWTError as e:
        raise ApiError(403, "forbidden", "Link expired") from e
    ext = key.rsplit(".", 1)[-1]
    mime = {**AUDIO_TYPES, **IMAGE_TYPES}.get(ext, "application/octet-stream")
    if not storage.exists(key):
        raise ApiError(404, "not_found", "Not found")
    return Response(content=storage.get_bytes(key), media_type=mime, headers={"Cache-Control": "private, no-store"})
