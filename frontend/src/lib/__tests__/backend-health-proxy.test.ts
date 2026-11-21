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
