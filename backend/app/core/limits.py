"""Request body size limit, enforced as the body streams in.

Without it, Starlette spools a multipart upload of any size to disk before the endpoint's own
per-file checks run, so one authenticated request could fill the server's disk.
"""

import json

from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        declared = dict(scope.get("headers") or []).get(b"content-length")
        if declared is not None:
            try:
                too_big = int(declared) > self.max_bytes
            except ValueError:
                too_big = False
            if too_big:
                await self._reject(send)
                return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    # Raised inside the endpoint's body parsing; FastAPI re-raises HTTPException as is.
                    raise HTTPException(413, f"Request exceeds {self.max_bytes // (1024 * 1024)} MB")
            return message

        await self.app(scope, limited_receive, send)

    async def _reject(self, send: Send) -> None:
        msg = f"Request exceeds {self.max_bytes // (1024 * 1024)} MB"
        body = json.dumps({"error": {"code": "payload_too_large", "message": msg}, "detail": msg}).encode()
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                    (b"connection", b"close"),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})
