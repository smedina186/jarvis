import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";

test("anonymous visitors cannot access the panel or proxy", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Entrar con GitHub" })).toBeVisible();
  expect((await request.get("/api/backend/health")).status()).toBe(401);
  expect((await request.get("/api/memory/key")).status()).toBe(401);
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
  // Explicit browser fixtures: no real microphone, speech service or Gemini call.
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    w.SpeechRecognition = undefined;
    w.webkitSpeechRecognition = class {
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      start() { queueMicrotask(() => { this.onstart?.(); this.onresult?.({ results: { length: 1, 0: { 0: { transcript: "Jarvis, buenos días. ¿Cómo estás?" } } } }); }); }
      stop() { this.onend?.(); } abort() {}
    };
    w.SpeechSynthesisUtterance = class { constructor(public text: string) {} };
    w.__voiceSpeakCount = 0;
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      getVoices: () => [{ voiceURI: "test-es", lang: "es-ES", name: "Jorge", localService: true }],
      addEventListener() {}, removeEventListener() {}, cancel() {}, resume() {},
      speak(item: { onstart?: () => void }) { w.__voiceSpeakCount = Number(w.__voiceSpeakCount) + 1; queueMicrotask(() => item.onstart?.()); },
    } });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bienvenido, Sebastián. ¿En qué trabajamos hoy?" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Backend privado conectado");
  await expect(page.getByRole("img", { name: "Núcleo visual de JARVIS" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Mensaje a JARVIS" })).toBeEnabled();
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
  await expect(page.getByText("Respuesta controlada para prueba local", { exact: true }).last()).toBeVisible();
  expect(generated).toBe(1);
  await page.getByRole("textbox", { name: "Mensaje a JARVIS" }).fill("Mi empresa vende muebles de oficina.");
  await page.getByText("Archivo cifrado de este navegador (opcional)", { exact: true }).click();
  await page.getByText(/^Memoria personal y de empresa/).click();
  await page.getByLabel("Título del recuerdo", { exact: true }).fill("Empresa de prueba");
  await page.getByRole("button", { name: "Guardar lo que acabo de contar" }).click();
  await expect(page.getByText(/Guardado cifrado en este navegador/)).toBeVisible();
  const cipher = await page.evaluate(() => localStorage.getItem("jarvis.memory.v1"));
  expect(cipher).not.toContain("muebles"); expect(cipher).not.toContain("Empresa de prueba");
  await page.reload();
  await page.getByText("Archivo cifrado de este navegador (opcional)", { exact: true }).click();
  await page.getByText(/^Memoria personal y de empresa/).click();
  await expect(page.getByText("Empresa de prueba", { exact: true })).toBeVisible();
  await page.getByLabel(/Usar mi memoria al responder/).check();
  await page.getByText("Ajustes de voz y dictado", { exact: true }).click();
  await page.getByRole("switch", { name: "Modo voz" }).click();
  await expect(page.getByRole("button", { name: "Iniciar dictado" })).toBeDisabled();
  await page.getByLabel("Acepto usar el reconocimiento de voz del navegador").check();
  await page.getByRole("button", { name: "Iniciar dictado" }).click();
  await expect(page.locator(".jarvis-eye-scene")).toHaveAttribute("data-activity", "listening");
  await expect(page.getByRole("textbox", { name: "Mensaje a JARVIS" })).toHaveValue("Jarvis, buenos días. ¿Cómo estás?");
  expect(generated).toBe(1);
  await page.getByRole("button", { name: "Finalizar dictado" }).click();
  await page.getByRole("textbox", { name: "Mensaje a JARVIS" }).fill("Jarvis, buenos días. ¿Cómo estás? Responde breve.");
  await page.getByRole("button", { name: "Enviar mensaje a Gemini" }).click();
  await expect(page.locator(".jarvis-eye-scene")).toHaveAttribute("data-activity", "speaking");
  expect(generated).toBe(2);
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__voiceSpeakCount)).toBe(1);
  await page.getByRole("button", { name: "Detener voz" }).click();
  await expect(page.locator(".jarvis-eye-scene")).toHaveAttribute("data-activity", "idle");
  await page.getByRole("switch", { name: "Modo voz" }).click();
  await page.getByRole("button", { name: "Conexiones" }).click();
  await expect(page.getByRole("heading", { name: "Conexiones" })).toBeVisible();
  await expect(page.getByText("Sin API gratuita autorizada; la suscripción personal no la activa").first()).toBeVisible();
  await page.getByRole("button", { name: "Chat", exact: true }).click();
  await expect(page.getByText("Respuesta controlada para prueba local", { exact: true }).last()).toBeVisible();
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
