# RESEARCH: googleapis/python-genai; official generateContent REST and pricing (2026-11-21).
# DECISION: Reuse async HTTPX in the small private image. No paid tools or SDK retries.
from __future__ import annotations

import asyncio
from collections import deque
from datetime import UTC, datetime
from time import monotonic
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

from config import Settings

FREE_MODEL = "gemini-3.5-flash-lite"


class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=6000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def bounded_conversation(self) -> ChatRequest:
        if sum(len(m.text) for m in self.messages) > 24000:
            raise ValueError("Conversation is too long")
        if self.messages[-1].role != "user":
            raise ValueError("Last message must be from user")
        for i, m in enumerate(self.messages):
            if not m.text.strip() or m.role != ("user" if i % 2 == 0 else "assistant"):
                raise ValueError("Messages must alternate, without empty content")
        return self


class GeminiChat:
    """Bounded requests; never log keys, conversation text or raw provider errors."""

    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.transport: httpx.AsyncBaseTransport | None = None
        self.lock = asyncio.Lock()
        self.error: str | None = None
        self.verified = False
        self.recent: deque[float] = deque()
        self.day = datetime.now(UTC).date()
        self.attempts = 0
        self.cooldown = 0.0

    def status(self) -> dict:
        configured = bool(self.settings.gemini_api_key and self.settings.gemini_api_key.strip())
        ready = (
            configured
            and self.settings.gemini_enabled
            and self.settings.gemini_free_confirmed
            and self.settings.gemini_model == FREE_MODEL
        )
        detail = (
            "Falta GEMINI_API_KEY en Render."
            if not configured
            else "Clave presente; faltan autorización o confirmación del nivel gratuito."
            if not ready
            else "Respuesta real verificada."
            if self.verified
            else "Configurado; todavía no se ha realizado una llamada real."
        )
        return {
            "provider": "gemini",
            "state": "error" if self.error else "configured" if configured else "not_configured",
            "configured": configured,
            "enabled": ready,
            "verified": self.verified,
            "model": self.settings.gemini_model,
            "error": self.error,
            "detail": self.error or detail,
            "retry_after": max(0, int(self.cooldown - monotonic()) + 1),
        }

    async def generate(self, request: ChatRequest) -> dict:
        if not self.status()["configured"]:
            raise HTTPException(503, "Gemini sin configurar: falta la clave en Render.")
        if not self.status()["enabled"]:
            raise HTTPException(
                403, "Llamadas bloqueadas: falta autorización o confirmar nivel gratuito."
            )
        now = monotonic()
        if self.cooldown > now:
            raise HTTPException(
                429,
                "Límite de Gemini. Espera antes de reintentar.",
                headers={"Retry-After": str(int(self.cooldown - now) + 1)},
            )
        if self.lock.locked():
            raise HTTPException(429, "Hay otra solicitud en curso.", headers={"Retry-After": "5"})
        async with self.lock:
            today = datetime.now(UTC).date()
            if today != self.day:
                self.day, self.attempts = today, 0
            while self.recent and now - self.recent[0] >= 60:
                self.recent.popleft()
            if self.attempts >= 20:
                utc_now = datetime.now(UTC)
                remaining = 86400 - (utc_now.hour * 3600 + utc_now.minute * 60 + utc_now.second)
                raise HTTPException(
                    429,
                    "Límite diario preventivo alcanzado. Se restablece a las 00:00 UTC.",
                    headers={"Retry-After": str(remaining)},
                )
            if len(self.recent) >= 6:
                remaining = max(1, int(60 - (now - self.recent[0])) + 1)
                raise HTTPException(
                    429,
                    "Límite por minuto alcanzado. Sin reintento automático.",
                    headers={"Retry-After": str(remaining)},
                )
            self.recent.append(now)
            self.attempts += 1
            payload = {
                "systemInstruction": {
                    "parts": [
                        {
                            "text": (
                                "Eres JARVIS, asistente personal privado. Responde en español. "
                                "No tienes herramientas, archivos ni comunicaciones externas. "
                                "No inventes acciones ejecutadas ni estados de servicios."
                            )
                        }
                    ]
                },
                "contents": [
                    {
                        "role": "model" if m.role == "assistant" else "user",
                        "parts": [{"text": m.text}],
                    }
                    for m in request.messages
                ],
                "generationConfig": {"maxOutputTokens": 1024},
            }
            try:
                async with asyncio.timeout(22):
                    async with httpx.AsyncClient(
                        transport=self.transport,
                        timeout=20,
                        follow_redirects=False,
                        trust_env=False,
                    ) as client:
                        response = await client.post(
                            f"https://generativelanguage.googleapis.com/v1beta/models/{FREE_MODEL}:generateContent",
                            headers={
                                "x-goog-api-key": self.settings.gemini_api_key,
                                "Content-Type": "application/json",
                            },
                            json=payload,
                        )
                if response.status_code == 429:
                    self.cooldown = monotonic() + 60
                    self.error = "Límite de Gemini alcanzado. No se reintentará automáticamente."
                    raise HTTPException(429, self.error, headers={"Retry-After": "60"})
                if response.status_code != 200:
                    self.error = (
                        "Google rechazó la clave o sus permisos. Revísalos en Render y AI Studio."
                        if response.status_code in {400, 401, 403}
                        else "Modelo no disponible. No se utilizará otro automáticamente."
                        if response.status_code == 404
                        else "Gemini no está disponible temporalmente."
                    )
                    raise HTTPException(502, self.error)
                candidate = (response.json().get("candidates") or [{}])[0]
                text = "\n".join(
                    p["text"]
                    for p in candidate.get("content", {}).get("parts", [])
                    if isinstance(p.get("text"), str) and not p.get("thought")
                )
                if not text.strip():
                    self.error = "Gemini no devolvió texto utilizable o bloqueó la solicitud."
                    raise HTTPException(502, self.error)
                self.error, self.verified = None, True
                return {
                    "provider": "gemini",
                    "model": FREE_MODEL,
                    "text": text,
                    "truncated": candidate.get("finishReason") == "MAX_TOKENS",
                }
            except (TimeoutError, httpx.TimeoutException):
                self.error = "Gemini tardó demasiado. Puedes reintentar manualmente."
                raise HTTPException(504, self.error) from None
            except (
                httpx.RequestError,
                ValueError,
                TypeError,
                KeyError,
                AttributeError,
                IndexError,
            ):
                self.error = "No se pudo obtener una respuesta válida de Gemini."
                raise HTTPException(502, self.error) from None

    def router(self) -> APIRouter:
        router = APIRouter()

        @router.get("/api/gemini/status")
        async def status() -> dict:
            return self.status()

        @router.post("/api/chat")
        async def chat(request: ChatRequest) -> dict:
            return await self.generate(request)

        return router
