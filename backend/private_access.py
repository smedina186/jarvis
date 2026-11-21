# RESEARCH: PyJWT (jpadilla/pyjwt), Starlette ASGI middleware, Auth.js stateless sessions.
# DECISION: Use PyJWT for short-lived server-to-server credentials; deny legacy tools.
from __future__ import annotations

from collections.abc import Callable
from time import time

import jwt
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from config import Settings

PRIVATE_READ_PATHS = {"/api/health", "/api/services", "/api/tasks", "/api/gemini/status"}
PRIVATE_WRITE_PATHS = {"/api/chat"}


class PrivateAccessMiddleware:
    """Authenticate HTTP APIs and deny unsupported realtime transports by default."""

    def __init__(self, app: ASGIApp, settings_factory: Callable[[], Settings]) -> None:
        self.app = app
        self.settings_factory = settings_factory

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "websocket":
            # Browser WebSockets cannot use the server-only signing secret.
            # Keep voice/glasses closed until a separate authenticated protocol exists.
            await send({"type": "websocket.close", "code": 4403})
            return
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        if scope["path"] == "/healthz" and scope["method"] in {"GET", "HEAD"}:
            response = JSONResponse({"status": "ok"}, headers={"Cache-Control": "no-store"})
            await response(scope, receive, send)
            return

        settings = self.settings_factory()
        secret = settings.backend_auth_secret.get_secret_value()
        owner = settings.owner_github_id
        status, detail = 401, "Authentication required"
        if len(secret.encode()) < 32 or not owner:
            status, detail = 503, "Private access is not configured"
        else:
            headers = dict(scope.get("headers", []))
            header = headers.get(b"authorization", b"").decode("latin-1")
            try:
                scheme, token = header.split(" ", 1)
                if scheme.lower() != "bearer":
                    raise ValueError("Invalid scheme")
                claims = jwt.decode(
                    token,
                    secret,
                    algorithms=["HS256"],
                    audience="jarvis-api",
                    issuer="jarvis-web",
                    options={"require": ["sub", "exp", "iat", "iss", "aud"]},
                )
                if claims["sub"] != owner:
                    status, detail = 403, "Owner access required"
                elif claims["exp"] - claims["iat"] > 60 or claims["iat"] > time() + 5:
                    raise ValueError("Invalid token lifetime")
                elif settings.personal_mode and (
                    not (scope["method"] == "GET" and scope["path"] in PRIVATE_READ_PATHS)
                    and not (scope["method"] == "POST" and scope["path"] in PRIVATE_WRITE_PATHS)
                ):
                    status, detail = 403, "Legacy research and capture tools are disabled"
                else:
                    await self.app(scope, receive, send)
                    return
            except (jwt.InvalidTokenError, ValueError, TypeError):
                pass
        response = JSONResponse(
            {"detail": detail},
            status_code=status,
            headers={"Cache-Control": "no-store", "WWW-Authenticate": "Bearer"},
        )
        await response(scope, receive, send)
