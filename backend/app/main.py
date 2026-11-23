import json
import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import admin, ai, content, health, research, student, sync, teacher
from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.core.limits import BodySizeLimitMiddleware


class JsonFormatter(logging.Formatter):
    """One JSON object per line, for log aggregators. Messages never contain student content."""

    def format(self, record: logging.LogRecord) -> str:
        out = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        for k in ("request_id", "method", "route", "status", "ms"):
            if hasattr(record, k):
                out[k] = getattr(record, k)
        if record.exc_info:
            out["exc"] = self.formatException(record.exc_info)
        return json.dumps(out, ensure_ascii=False)


def configure_logging(fmt: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter() if fmt == "json" else logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(logging.INFO)
    # httpx logs every request URL at INFO. Provider URLs can carry API keys or signed parameters.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)


log = logging.getLogger("vgyan.http")


def create_app() -> FastAPI:
    s = get_settings()
    configure_logging(s.log_format)
    app = FastAPI(
        title="VGyan API",
        version=__version__,
        description="Bilingual (English/Kannada) reading and writing assessment backend.",
        docs_url="/docs",
        redoc_url=None,
    )
    install_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["Content-Disposition", "X-Content-SHA256", "X-Request-ID", "X-Export-ID"],
    )

    @app.middleware("http")
    async def access_log(request: Request, call_next):
        started = time.monotonic()
        # Accept a caller's ID only if it looks like one (it is echoed into logs and headers).
        rid = request.headers.get("x-request-id", "")
        if not (0 < len(rid) <= 64 and all(c.isalnum() or c in "-_" for c in rid)):
            rid = uuid.uuid4().hex
        request.state.request_id = rid
        response = await call_next(request)
        # Route template only (no query strings, no bodies): nothing identifying in logs.
        route = request.scope.get("route")
        path = getattr(route, "path", "unmatched")
        ms = round((time.monotonic() - started) * 1000)
        log.info(
            "%s %s %s %dms rid=%s",
            request.method,
            path,
            response.status_code,
            ms,
            rid,
            extra={"request_id": rid, "method": request.method, "route": path, "status": response.status_code, "ms": ms},
        )
        response.headers["X-Request-ID"] = rid
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers.setdefault("Cache-Control", "no-store")
        if s.env == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    # Outermost: refuse oversized bodies before anything reads them.
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=s.max_request_mb * 1024 * 1024)

    for r in (health.router, student.router, sync.router, ai.router, teacher.router, content.router, research.router, admin.router):
        app.include_router(r)
    return app


app = create_app()
