import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";

// Browser protocol regression, with explicit microphone/TTS/Gemini fixtures.
// This reproduces a WebKit recognizer ending after the first short segment.
// It does not certify physical iPad speech recognition or audible sound.
test("a short WebKit segment cannot discard the rest of a spoken request", async ({ page, context }) => {
  const value = await encode({ secret: "local-e2e-test-session-secret-not-for-production-098765", salt: "authjs.session-token", token: { sub: "123456" }, maxAge: 300 });
  await context.addCookies([{ name: "authjs.session-token", value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await page.addInitScript(() => {
    const data = window as unknown as { SpeechRecognition: unknown; webkitSpeechRecognition: unknown; SpeechSynthesisUtterance: unknown; __spoken: string[]; __captureAborted: number };
    data.__spoken = []; data.__captureAborted = 0;
    data.SpeechRecognition = undefined;
    let starts = 0;
    data.webkitSpeechRecognition = class {
      onstart?: () => void; onend?: () => void;
      onresult?: (event: unknown) => void;
      start() {
        const segment = ++starts;
        queueMicrotask(() => {
          this.onstart?.();
          this.onresult?.({ results: { length: 1, 0: { isFinal: true, 0: { transcript: segment === 1 ? "Jarvis hola" : "necesito que me ayudes con las ventas y los anuncios de mi empresa" } } } });
          if (segment === 1) setTimeout(() => this.onend?.(), 20);
        });
      }
      stop() { this.onend?.(); }
      abort() { data.__captureAborted++; }
    };
    data.SpeechSynthesisUtterance = class { constructor(public text: string) {} };
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      getVoices: () => [], addEventListener() {}, removeEventListener() {}, cancel() {}, resume() {},
      speak(item: { text: string; onstart?: () => void; onend?: () => void }) {
        data.__spoken.push(item.text);
        queueMicrotask(() => { item.onstart?.(); if (item.text.trim() === "Te escucho.") item.onend?.(); });
      },
    } });
  });
  await page.route("**/api/backend/gemini/status", route => route.fulfill({ json: { state: "configured", enabled: true, verified: false, model: "gemini-3.5-flash-lite", detail: "Fixture explícito" } }));
  let generations = 0;
  let submitted = "";
  let abortedBeforeRequest = false;
  await page.route("**/api/backend/chat", async route => {
    generations++;
    const body = route.request().postDataJSON();
    submitted = body.messages.at(-1).text;
    abortedBeforeRequest = await page.evaluate(() => (window as unknown as { __captureAborted: number }).__captureAborted > 0);
    await route.fulfill({ json: { provider: "gemini", text: "Respuesta controlada: vamos a organizar las ventas y los anuncios." } });
  });
  page.on("dialog", dialog => dialog.accept());
  await page.goto("/");
  await expect(page.getByText("Backend privado conectado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hablar con JARVIS", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Mensaje a JARVIS" })).toHaveValue(/necesito que me ayudes.*empresa/);
  expect(generations).toBe(0);
  await expect.poll(() => generations, { timeout: 12_000 }).toBe(1);
  expect(submitted).toContain("hola");
  expect(submitted).toContain("necesito que me ayudes con las ventas y los anuncios de mi empresa");
  expect(abortedBeforeRequest).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.join(" "))).toContain("Respuesta controlada:");
  await expect(page.locator(".jarvis-eye-scene")).toHaveAttribute("data-activity", "speaking");
  await page.getByRole("button", { name: "Detener conversación", exact: true }).click();
  expect(generations).toBe(1);
});
