"""Small private control plane. No vision, scraping, model downloads or agent startup."""

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from config import get_settings
from durable.routes import DurableRuntime
from gemini_chat import GeminiChat
from private_access import PrivateAccessMiddleware

settings = get_settings()
app = FastAPI(title="JARVIS privado", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(PrivateAccessMiddleware, settings_factory=lambda: settings)
gemini = GeminiChat(settings)
app.include_router(gemini.router())
durable = DurableRuntime(settings)
gemini.memory_runtime = durable
app.include_router(durable.router())


@app.exception_handler(RequestValidationError)
async def safe_validation(_request, _error):
    return JSONResponse(
        {"detail": "Entrada inválida: revisa tipos y límites"},
        status_code=422,
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "environment": settings.environment,
        "mode": "private",
        "capabilities": {
            "chat": "ready" if gemini.status()["enabled"] else "not_configured",
            "agents": "disabled",
            "face_recognition": "disabled",
            "personal_research": "disabled",
            "realtime": "disabled",
        },
    }


@app.get("/api/services")
async def services() -> list[dict]:
    return [
        {"name": name, "configured": configured, "active": False}
        for name, configured in settings.service_flags().items()
    ]
