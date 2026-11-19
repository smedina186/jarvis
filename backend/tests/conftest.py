from time import time

import jwt
import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

TEST_SECRET = "unit-test-signing-secret-only-not-for-deployment-0123456789"
TEST_OWNER = "123456"


@pytest.fixture
def owner_headers() -> dict[str, str]:
    token = jwt.encode(
        {"sub": TEST_OWNER, "iat": int(time()), "exp": int(time()) + 60,
         "iss": "jarvis-web", "aud": "jarvis-api"},
        TEST_SECRET, algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def authenticate_legacy_contract_tests(request, monkeypatch, owner_headers):
    """Legacy contract tests run as an authenticated owner; no production bypass exists."""
    module = request.node.module
    if module.__name__.rsplit(".", 1)[-1] not in {
        "test_health", "test_services", "test_capture", "test_webhook",
        "test_integration", "test_identify_endpoint",
    }:
        return
    import main

    monkeypatch.setattr(main.settings, "backend_auth_secret", SecretStr(TEST_SECRET))
    monkeypatch.setattr(main.settings, "owner_github_id", TEST_OWNER)
    # Exercise the preserved legacy contracts with fake data, never enable these in production.
    monkeypatch.setattr(main.settings, "personal_mode", False)
    client = getattr(module, "client", None)
    if isinstance(client, TestClient):
        monkeypatch.setitem(client.headers, "Authorization", owner_headers["Authorization"])
