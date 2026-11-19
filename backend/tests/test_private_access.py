from time import time

import jwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from config import Settings
from private_access import PrivateAccessMiddleware

SECRET = "private-access-test-secret-at-least-32-bytes-012345"
OWNER = "123456"


def make_client(secret: str = SECRET) -> TestClient:
    settings = Settings(
        _env_file=None, JARVIS_OWNER_GITHUB_ID=OWNER,
        JARVIS_BACKEND_AUTH_SECRET=secret, JARVIS_PERSONAL_MODE=True,
    )
    app = FastAPI()
    app.add_middleware(PrivateAccessMiddleware, settings_factory=lambda: settings)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.get("/api/research/someone/stream")
    def stream():
        raise AssertionError("Personal research must never run")

    @app.post("/api/capture/identify")
    def identify():
        raise AssertionError("Identification must never run")

    return TestClient(app)


def authorization(**overrides) -> dict[str, str]:
    claims = {
        "sub": OWNER, "iat": int(time()), "exp": int(time()) + 60,
        "iss": "jarvis-web", "aud": "jarvis-api",
    }
    claims.update(overrides)
    return {"Authorization": "Bearer " + jwt.encode(claims, SECRET, algorithm="HS256")}


def test_no_configuration_fails_closed():
    client = make_client(secret="")
    assert client.get("/api/health").status_code == 503
    assert client.get("/healthz").json() == {"status": "ok"}


def test_healthz_reveals_no_services_or_configuration():
    response = make_client().get("/healthz")
    assert response.json() == {"status": "ok"}
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("path", ["/api/health", "/api/services", "/docs", "/openapi.json"])
def test_unauthenticated_access_is_denied(path):
    assert make_client().get(path).status_code == 401


def test_valid_owner_token_can_read_status():
    assert make_client().get("/api/health", headers=authorization()).status_code == 200


def test_other_user_is_denied():
    assert make_client().get("/api/health", headers=authorization(sub="other")).status_code == 403


@pytest.mark.parametrize("claims", [
    {"exp": int(time()) - 10}, {"iss": "attacker"}, {"aud": "other-api"},
    {"exp": int(time()) + 3600}, {"iat": int(time()) + 30}, {"exp": "invalid"},
])
def test_expired_wrong_or_overlong_tokens_are_denied(claims):
    assert make_client().get("/api/health", headers=authorization(**claims)).status_code == 401


def test_forged_signature_is_denied():
    token = jwt.encode(
        {"sub": OWNER, "iat": int(time()), "exp": int(time()) + 60,
         "iss": "jarvis-web", "aud": "jarvis-api"},
        "wrong-secret-at-least-32-bytes-for-test", algorithm="HS256",
    )
    response = make_client().get("/api/health", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_even_owner_cannot_identify_or_research_people():
    client = make_client()
    assert client.post("/api/capture/identify", headers=authorization()).status_code == 403
    assert client.get("/api/research/someone/stream", headers=authorization()).status_code == 403


def test_websocket_is_closed_without_processing_audio():
    with (
        pytest.raises(WebSocketDisconnect) as exc,
        make_client().websocket_connect("/ws/audio/test"),
    ):
        pass
    assert exc.value.code == 4403
