import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";

test("anonymous visitors cannot access the panel or proxy", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Entrar con GitHub" })).toBeVisible();
  expect((await request.get("/api/backend/health")).status()).toBe(401);
  expect((await request.get("/api/backend/gemini/status")).status()).toBe(401);
  expect((await request.post("/api/backend/chat", { data: {} })).status()).toBe(401);
  expect((await request.post("/api/backend/agents/research")).status()).toBe(403);
});

test("local owner test session connects to FastAPI and can sign out", async ({ page, context }) => {
  // Synthetic Auth.js session for local protocol tests, not a real GitHub OAuth login.
  const cookie = await encode({
    secret: "local-e2e-test-session-secret-not-for-production-098765",
    salt: "authjs.session-token", token: { sub: "123456", name: "Test Owner" }, maxAge: 300,
  });
  await context.addCookies([{
    name: "authjs.session-token", value: cookie, domain: "127.0.0.1", path: "/",
    httpOnly: true, sameSite: "Lax",
  }]);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bienvenido, Sebastián. ¿En qué trabajamos hoy?" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Backend privado conectado");
  await expect(page.getByRole("img", { name: "Núcleo visual de JARVIS" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Mensaje a JARVIS" })).toBeDisabled();
  // Local controlled protocol fixtures only. No Google calls or real API credentials.
  await page.route("**/api/backend/gemini/status", route => route.fulfill({ json: {
    state: "configured", enabled: true, verified: false, model: "gemini-3.5-flash-lite", detail: "Configuración de prueba local",
  } }));
  let generated = 0;
  await page.route("**/api/backend/chat", route => {
    generated++;
    return route.fulfill({ json: { provider: "gemini", text: "Respuesta controlada para prueba local" } });
  });
  await page.getByRole("button", { name: "Comprobar conexión" }).click();
  await expect(page.getByRole("textbox", { name: "Mensaje a JARVIS" })).toBeEnabled();
  expect(generated).toBe(0);
  await page.getByRole("textbox", { name: "Mensaje a JARVIS" }).fill("Mensaje de prueba local");
  await page.getByRole("button", { name: "Enviar mensaje a Gemini" }).click();
  await expect(page.getByText("Respuesta controlada para prueba local", { exact: true })).toBeVisible();
  expect(generated).toBe(1);
  await page.getByRole("button", { name: "Conexiones" }).click();
  await expect(page.getByRole("heading", { name: "Conexiones" })).toBeVisible();
  await expect(page.getByText("Integración de IA pendiente").first()).toBeVisible();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByText("Respuesta controlada para prueba local", { exact: true })).toBeVisible();
  expect((await context.request.get("/api/backend/research/someone/stream")).status()).toBe(403);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  expect((await context.request.get("/api/backend/health")).status()).toBe(401);
});

test("a different account ID cannot open the panel", async ({ page, context }) => {
  const cookie = await encode({
    secret: "local-e2e-test-session-secret-not-for-production-098765",
    salt: "authjs.session-token", token: { sub: "999999" }, maxAge: 300,
  });
  await context.addCookies([{
    name: "authjs.session-token", value: cookie, domain: "127.0.0.1", path: "/",
    httpOnly: true, sameSite: "Lax",
  }]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
