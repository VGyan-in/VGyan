import threading
import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import ApiError


class RateLimiter:
    """Sliding-window limiter in process memory. Limits apply per worker process: with
    WEB_CONCURRENCY=2 the effective limit is up to twice the configured one. Use a shared store
    (e.g. Redis) before scaling to several instances."""

    _PRUNE_EVERY = 1000

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._windows: dict[str, float] = {}
        self._lock = threading.Lock()
        self._calls = 0

    def check(self, key: str, limit: int, window_s: float) -> None:
        if not get_settings().rate_limit_enabled:
            return
        now = time.monotonic()
        with self._lock:
            self._calls += 1
            if self._calls % self._PRUNE_EVERY == 0:
                self._prune(now)
            q = self._hits[key]
            self._windows[key] = window_s
            while q and now - q[0] > window_s:
                q.popleft()
            if len(q) >= limit:
                raise ApiError(429, "rate_limited", "Too many requests. Please wait and try again.")
            q.append(now)

    def _prune(self, now: float) -> None:
        """Drop keys whose window has fully expired, so memory does not grow with every IP/ID seen."""
        for key in [k for k, q in self._hits.items() if not q or now - q[-1] > self._windows.get(k, 0)]:
            self._hits.pop(key, None)
            self._windows.pop(key, None)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
            self._windows.clear()

    def size(self) -> int:
        return len(self._hits)


limiter = RateLimiter()


def client_ip(request: Request) -> str:
    """The caller's address for rate limiting.

    X-Forwarded-For is client-controlled: only the entries appended by our own proxies can be
    trusted. With TRUSTED_PROXY_HOPS=n the client is the n-th address from the right; with 0 (the
    default) the header is ignored and the socket peer is used.
    """
    hops = get_settings().trusted_proxy_hops
    if hops > 0:
        parts = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
        if len(parts) >= hops:
            return parts[-hops]
    return request.client.host if request.client else "unknown"
