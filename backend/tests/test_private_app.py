import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

import private_main


@pytest.fixture
def private_client(monkeypatch):
    monkeypatch.setattr(private_main.settings, "backend_auth_secret", SecretStr(
        "unit-test-signing-secret-only-not-for-deployment-0123456789",
    ))
    monkeypatch.setattr(private_main.settings, "owner_github_id", "123456")
    monkeypatch.setattr(private_main.settings, "personal_mode", True)
    return TestClient(private_main.app)


@pytest.mark.parametrize("path", [
    "/api/health", "/api/services", "/api/tasks", "/api/capture",
    "/api/agents/research", "/docs", "/openapi.json",
])
def test_actual_api_has_no_anonymous_business_endpoints(private_client, path):
    assert private_client.get(path).status_code == 401


def test_private_app_is_demo_only_and_does_not_expose_legacy_tools(private_client, owner_headers):
    response = private_client.get("/api/health", headers=owner_headers)
    assert response.status_code == 200
    assert response.json()["capabilities"] == {
        "chat": "not_configured", "agents": "disabled", "face_recognition": "disabled",
        "personal_research": "disabled", "realtime": "disabled",
    }
    assert private_client.post("/api/agents/research", headers=owner_headers).status_code == 403
    assert private_client.get("/healthz").json() == {"status": "ok"}
