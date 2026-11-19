"""Small private control plane. No vision, scraping, model downloads or agent startup."""
from fastapi import FastAPI

from config import get_settings
from private_access import PrivateAccessMiddleware

settings = get_settings()
app = FastAPI(title="JARVIS privado", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(PrivateAccessMiddleware, settings_factory=lambda: settings)


@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "environment": settings.environment,
        "mode": "private",
        "capabilities": {
            "chat": "not_configured",
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
