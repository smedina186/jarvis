"""All Gemini responses use HTTPX MockTransport; never contact Google."""

import asyncio
import json

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import SecretStr

import private_main
from config import Settings
from gemini_chat import FREE_MODEL, ChatRequest, GeminiChat


def service(**kwargs):
    settings = Settings(
        _env_file=None,
        GEMINI_API_KEY="fake-test-key-not-a-real-key",
        JARVIS_GEMINI_ENABLED=True,
        GEMINI_FREE_TIER_CONFIRMED=True,
        **kwargs,
    )
    return GeminiChat(settings)


def request():
    return ChatRequest(messages=[{"role": "user", "text": "hola"}])


def invoke(chat):
    return asyncio.run(chat.generate(request()))


def test_defaults_are_closed_and_key_presence_does_not_authorize_calls():
    chat = GeminiChat(
        Settings(
            _env_file=None,
            GEMINI_API_KEY="",
            JARVIS_GEMINI_ENABLED=False,
            GEMINI_FREE_TIER_CONFIRMED=False,
        )
    )
    assert chat.status()["state"] == "not_configured"
    with pytest.raises(HTTPException) as error:
        invoke(chat)
    assert error.value.status_code == 503
    chat.settings.gemini_api_key = "fake-test-key"
    assert chat.status()["state"] == "configured"
    assert chat.status()["verified"] is False
    with pytest.raises(HTTPException) as error:
        invoke(chat)
    assert error.value.status_code == 403
    chat.settings.gemini_enabled = True
    with pytest.raises(HTTPException):
        invoke(chat)
    chat.settings.gemini_free_confirmed = True
    chat.settings.gemini_model = "paid-model"
    with pytest.raises(HTTPException):
        invoke(chat)


def test_real_request_contract_and_no_key_in_payload_url_or_status():
    chat = service()

    def handler(req):
        assert req.url.host == "generativelanguage.googleapis.com"
        assert FREE_MODEL in str(req.url)
        assert "fake-test-key" not in str(req.url)
        assert req.headers["x-goog-api-key"] == "fake-test-key-not-a-real-key"
        data = json.loads(req.content)
        assert data["contents"][0]["parts"][0]["text"] == "hola"
        assert "tools" not in data
        return httpx.Response(
            200,
            json={
                "candidates": [{"content": {"parts": [{"text": "Respuesta controlada de prueba"}]}}]
            },
        )

    chat.transport = httpx.MockTransport(handler)
    assert invoke(chat)["text"] == "Respuesta controlada de prueba"
    assert chat.status()["verified"] is True
    assert "fake-test-key" not in str(chat.status())


@pytest.mark.parametrize(
    "code,expected", [(400, 502), (401, 502), (403, 502), (404, 502), (429, 429), (503, 502)]
)
def test_provider_errors_are_sanitized_without_retries(code, expected):
    chat = service()
    calls = []

    def handler(req):
        calls.append(req)
        return httpx.Response(code, json={"error": "SECRET_ECHO fake-test-key"})

    chat.transport = httpx.MockTransport(handler)
    with pytest.raises(HTTPException) as error:
        invoke(chat)
    assert error.value.status_code == expected
    assert "SECRET_ECHO" not in str(error.value.detail)
    assert "fake-test-key" not in str(chat.status())
    assert chat.status()["state"] == "error"
    assert len(calls) == 1
    if code == 429:
        with pytest.raises(HTTPException):
            invoke(chat)
        assert len(calls) == 1


def test_timeout_empty_response_and_local_quota():
    chat = service()

    def timeout(req):
        raise httpx.ReadTimeout("fake-test-key must not leak", request=req)

    chat.transport = httpx.MockTransport(timeout)
    with pytest.raises(HTTPException) as error:
        invoke(chat)
    assert error.value.status_code == 504
    assert "fake-test-key" not in error.value.detail
    chat.transport = httpx.MockTransport(lambda _: httpx.Response(200, json={"candidates": []}))
    with pytest.raises(HTTPException) as error:
        invoke(chat)
    assert error.value.status_code == 502
    chat.attempts = 20
    with pytest.raises(HTTPException) as error:
        invoke(chat)
    assert error.value.status_code == 429


def test_new_routes_require_owner_and_do_not_open_legacy_tools(monkeypatch, owner_headers):
    monkeypatch.setattr(
        private_main.settings,
        "backend_auth_secret",
        SecretStr("unit-test-signing-secret-only-not-for-deployment-0123456789"),
    )
    monkeypatch.setattr(private_main.settings, "owner_github_id", "123456")
    monkeypatch.setattr(private_main.settings, "personal_mode", True)
    monkeypatch.setattr(private_main.settings, "gemini_api_key", None)
    client = TestClient(private_main.app)
    assert client.get("/api/gemini/status").status_code == 401
    assert client.post("/api/chat", json={}).status_code == 401
    assert client.get("/api/gemini/status", headers=owner_headers).json()["configured"] is False
    assert (
        client.post(
            "/api/chat",
            headers=owner_headers,
            json={"messages": [{"role": "user", "text": "hola"}]},
        ).status_code
        == 503
    )
    assert client.post("/api/agents/research", headers=owner_headers).status_code == 403
    for messages in [
        [{"role": "user", "text": " "}],
        [{"role": "assistant", "text": "hola"}],
        [{"role": "user", "text": "x" * 6001}],
    ]:
        assert (
            client.post("/api/chat", headers=owner_headers, json={"messages": messages}).status_code
            == 422
        )


def test_specialists_and_memory_are_grounded_without_tools():
    from personal_agents import select_agent

    assert select_agent("Ayúdame a vender muebles")[0] == "sales"
    assert select_agent("Optimiza Meta Ads")[0] == "meta_ads"
    assert select_agent("Corrige el código Python")[0] == "coding"
    chat = service()

    def handler(req):
        payload = json.loads(req.content)
        assert "No publiques anuncios" in payload["systemInstruction"]["parts"][0]["text"]
        assert (
            "no afirmes haber leído archivos completos"
            in payload["contents"][0]["parts"][0]["text"]
        )
        assert "Muebles privados" in payload["contents"][0]["parts"][0]["text"]
        assert "tools" not in payload
        return httpx.Response(
            200, json={"candidates": [{"content": {"parts": [{"text": "Respuesta de prueba"}]}}]}
        )

    chat.transport = httpx.MockTransport(handler)
    result = asyncio.run(
        chat.generate(
            ChatRequest(
                messages=[{"role": "user", "text": "Optimiza Meta Ads"}],
                agent="meta_ads",
                memories=[{"title": "Empresa", "text": "Muebles privados"}],
                memory_index=["Empresa"],
            )
        )
    )
    assert result["agent"] == "meta_ads"
    assert result["memory_sources"] == ["Empresa"]
