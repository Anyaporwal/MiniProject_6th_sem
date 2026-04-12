"""
Middleware for SafeRoute: Rate limiting, request logging.
"""
import time
import logging
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("saferoute.middleware")


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Simple in-memory rate limiter.
    - Authenticated: 100 requests per minute
    - Unauthenticated: 20 requests per minute
    """

    def __init__(self, app, auth_limit: int = 100, unauth_limit: int = 20, window: int = 60):
        super().__init__(app)
        self.auth_limit = auth_limit
        self.unauth_limit = unauth_limit
        self.window = window
        self._requests: dict[str, list[float]] = defaultdict(list)

    def _get_client_key(self, request: Request) -> tuple[str, bool]:
        """Return (client_key, is_authenticated)."""
        auth_header = request.headers.get("authorization", "")
        is_auth = auth_header.startswith("Bearer ")
        client_ip = request.client.host if request.client else "unknown"
        return f"{client_ip}:{is_auth}", is_auth

    def _is_limited(self, key: str, is_auth: bool) -> bool:
        now = time.time()
        # Remove old entries
        self._requests[key] = [t for t in self._requests[key] if now - t < self.window]
        limit = self.auth_limit if is_auth else self.unauth_limit
        if len(self._requests[key]) >= limit:
            return True
        self._requests[key].append(now)
        return False

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health check
        if request.url.path in ("/health", "/docs", "/openapi.json"):
            return await call_next(request)

        key, is_auth = self._get_client_key(request)
        if self._is_limited(key, is_auth):
            logger.warning(f"Rate limited: {key}")
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."},
            )

        # Process request with timing
        start = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start) * 1000

        logger.info(f"{request.method} {request.url.path} → {response.status_code} ({duration_ms:.0f}ms)")
        response.headers["X-Response-Time"] = f"{duration_ms:.0f}ms"

        return response
