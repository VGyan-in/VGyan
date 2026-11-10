import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import admin, ai, content, health, research, student, sync, teacher
from app.core.config import get_settings
from app.core.errors import install_error_handlers

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("vgyan.http")


def create_app() -> FastAPI:
    s = get_settings()
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
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["Content-Disposition", "X-Content-SHA256"],
    )

    @app.middleware("http")
    async def access_log(request: Request, call_next):
        started = time.monotonic()
        response = await call_next(request)
        # Route template only (no query strings, no bodies): nothing identifying in logs.
        route = request.scope.get("route")
        path = getattr(route, "path", "unmatched")
        log.info("%s %s %s %.0fms", request.method, path, response.status_code, (time.monotonic() - started) * 1000)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        if s.env == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    for r in (health.router, student.router, sync.router, ai.router, teacher.router, content.router, research.router, admin.router):
        app.include_router(r)
    return app


app = create_app()
