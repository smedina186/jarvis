"""Small private control plane. No vision, scraping, model downloads or agent startup."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from config import get_settings
from durable.routes import DurableRuntime
from gemini_chat import GeminiChat
from openjarvis_tools.runtime import AgentRuntime
from private_access import PrivateAccessMiddleware

settings = get_settings()


@asynccontextmanager
async def lifespan(_app):
    if settings.memory_mode == "approved_external":
        try:
            await durable.call(lambda m: m.repository.read(m.owner, "personal", "memory"))
            logging.getLogger("uvicorn.error").info("durable_memory_probe=verified")
        except HTTPException:
            logging.getLogger("uvicorn.error").warning(
                "durable_memory_probe=failed; chat remains available"
            )
    yield


app = FastAPI(
    lifespan=lifespan, title="JARVIS privado", docs_url=None, redoc_url=None, openapi_url=None
)
app.add_middleware(PrivateAccessMiddleware, settings_factory=lambda: settings)
gemini = GeminiChat(settings)
app.include_router(gemini.router())
durable = DurableRuntime(settings)
gemini.memory_runtime = durable
app.include_router(durable.router())
agent_runtime = AgentRuntime(gemini, durable)
app.include_router(agent_runtime.router())


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
            "agents": "bounded_on_demand" if gemini.status()["enabled"] else "not_configured",
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
