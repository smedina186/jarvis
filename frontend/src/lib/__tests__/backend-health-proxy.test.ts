// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/private-config", () => ({ authenticationReady: () => true, ownerId: () => "123456" }));
import { GET } from "@/app/api/backend/[...path]/route";
const request = () => GET(new Request("https://jarvis.example/api/backend/health"), { params: Promise.resolve({ path: ["health"] }) });
beforeEach(() => {
  mocks.auth.mockResolvedValue({ user: { id: "123456" } });
  vi.stubEnv("JARVIS_BACKEND_URL", "https://backend.example");
  vi.stubEnv("JARVIS_BACKEND_AUTH_SECRET", "test-backend-secret-not-for-production-0123456789");
  vi.stubEnv("AUTH_SECRET", "test-session-secret-not-for-production-9876543210");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it.each([401, 403])("maps backend %s to 502 without a login redirect or a retry", async status => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ detail: "Authentication required" }, { status }));
  vi.stubGlobal("fetch", fetchMock);
  const response = await request();
  expect(response.status).toBe(502);
  expect((await response.json()).error).toContain("Render rechazó la credencial privada");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("keeps unauthenticated browser requests at 401 and never contacts Render", async () => {
  mocks.auth.mockResolvedValue(null);
  const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  expect((await request()).status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("identifies missing backend configuration without exposing a signing secret", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ detail: "Private access is not configured" }, { status: 503 })));
  const response = await request();
  const data = await response.json();
  expect(response.status).toBe(503);
  expect(data.error).toContain("Falta configurar el acceso privado");
  expect(data.error).not.toContain(process.env.JARVIS_BACKEND_AUTH_SECRET);
});

it("proxies chat only from the same origin and never accepts a provider key from the browser", async () => {
  vi.stubEnv("AUTH_URL", "https://jarvis.example");
  const { POST } = await import("@/app/api/backend/[...path]/route");
  const context = { params: Promise.resolve({ path: ["chat"] }) };
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ text: "test", provider: "gemini" }));
  vi.stubGlobal("fetch", fetchMock);
  const cross = new Request("https://jarvis.example/api/backend/chat", { method: "POST", headers: { Origin: "https://other.example", "Content-Type": "application/json" }, body: "{}" });
  expect((await POST(cross, context)).status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
  const valid = new Request("https://jarvis.example/api/backend/chat", { method: "POST", headers: { Origin: "https://jarvis.example", "Content-Type": "application/json", "x-goog-api-key": "never-forward-this" }, body: JSON.stringify({ messages: [{ role: "user", text: "hola" }] }) });
  expect((await POST(valid, context)).status).toBe(200);
  const forwarded = fetchMock.mock.calls[0][1];
  expect(forwarded.headers.Authorization).toMatch(/^Bearer /);
  expect(forwarded.headers["x-goog-api-key"]).toBeUndefined();
});

it("preserves Gemini quota and activation errors instead of redirecting to OAuth", async () => {
  vi.stubEnv("AUTH_URL", "https://jarvis.example");
  const { POST } = await import("@/app/api/backend/[...path]/route");
  for (const status of [403, 429]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ detail: "Provider blocked" }, { status, headers: { "Retry-After": "60" } })));
    const response = await POST(new Request("https://jarvis.example/api/backend/chat", { method: "POST", headers: { Origin: "https://jarvis.example", "Content-Type": "application/json" }, body: "{}" }), { params: Promise.resolve({ path: ["chat"] }) });
    expect(response.status).toBe(status);
    expect(response.headers.get("Retry-After")).toBe("60");
  }
});
