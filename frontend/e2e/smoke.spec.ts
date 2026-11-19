import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";

test("anonymous visitors cannot access the panel or proxy", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("button", { name: "Entrar con GitHub" })).toBeVisible();
  expect((await request.get("/api/backend/health")).status()).toBe(401);
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
  await expect(page.getByRole("heading", { name: "Bienvenido a JARVIS" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Backend privado conectado");
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
