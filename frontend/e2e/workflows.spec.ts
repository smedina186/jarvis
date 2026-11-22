import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";

// Explicit protocol fixtures: no Google, Neon or real GitHub OAuth in these flows.
async function owner(page: Page, context: BrowserContext) {
  const value = await encode({ secret: "local-e2e-test-session-secret-not-for-production-098765", salt: "authjs.session-token", token: { sub: "123456", name: "Test Owner" }, maxAge: 300 });
  await context.addCookies([{ name: "authjs.session-token", value, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  await page.route("**/api/backend/gemini/status", route => route.fulfill({ json: { state: "configured", enabled: true, verified: false, model: "gemini-3.5-flash-lite", detail: "Fixture local; no Google" } }));
  await page.route("**/api/backend/memory/status", route => route.fulfill({ json: { state: "active", durable: true, memanto: "prepared_not_connected", cost: "no verificable" } }));
}

test("memory folders issue scoped CRUD and reload protocol data", async ({ page, context }) => {
  await owner(page, context);
  type Item = { id: string; content: string; kind: string; source: string; state: string; conflicts: string[] };
  const records: { [project: string]: Item[] } = { personal: [{ id: "fixture-budget", content: "Presupuesto controlado de prueba: $0", kind: "preference", source: "explicit", state: "active", conflicts: [] }], empresa: [] };
  const operations: { action: string; project: string; id?: string; memory?: { content: string; source: string } }[] = [];
  let fail = false;
  await page.route("**/api/backend/memory/operate", async route => {
    const body = route.request().postDataJSON(); operations.push(body);
    expect(route.request().method()).toBe("POST"); expect(body).not.toHaveProperty("owner");
    expect(["personal", "empresa"]).toContain(body.project);
    const items = records[body.project];
    if (body.action === "projects") return route.fulfill({ json: ["personal", "empresa"] });
    if (body.action === "list") return route.fulfill({ json: items });
    if (body.action === "recall") return route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: "Fallo controlado de memoria" } : items });
    if (body.action === "remember") {
      const item = { id: "fixture-company", content: body.memory.content, kind: "context", source: body.memory.source, state: "active", conflicts: [] };
      items.push(item); return route.fulfill({ json: item });
    }
    if (body.action === "update") {
      const item = items.find(item => item.id === body.id)!; item.content = body.memory.content; item.source = body.memory.source;
      return route.fulfill({ json: item });
    }
    if (body.action === "forget") { records[body.project] = items.filter(item => item.id !== body.id); return route.fulfill({ json: { deleted: true, id: body.id } }); }
    return route.fulfill({ status: 400, json: { error: "Fuera del fixture" } });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Memoria", exact: true }).click();
  await expect(page.getByText("Presupuesto controlado de prueba: $0", { exact: true })).toBeVisible();
  await expect(page.getByText("Conexión comprobada. Recuerdos cargados desde Neon.")).toBeVisible();
  await page.getByRole("button", { name: /📁 empresa/ }).click();
  await expect(page.getByText(/Esta carpeta aún no muestra recuerdos/)).toBeVisible();
  await page.getByText("Añadir recuerdo o carpeta", { exact: true }).click();
  await page.getByRole("textbox", { name: "Nuevo recuerdo", exact: true }).fill("La empresa de prueba vende muebles.");
  await page.getByRole("button", { name: "Guardar recuerdo", exact: true }).click();
  await expect(page.getByText("La empresa de prueba vende muebles.", { exact: true })).toBeVisible();
  expect(operations.filter(item => item.action === "remember")).toEqual([expect.objectContaining({ project: "empresa", memory: expect.objectContaining({ content: "La empresa de prueba vende muebles.", source: "explicit" }) })]);
  await page.getByRole("button", { name: "Corregir / confirmar", exact: true }).click();
  await page.getByRole("textbox", { name: "Corregir recuerdo", exact: true }).fill("La empresa de prueba vende escritorios.");
  await page.getByRole("button", { name: "Guardar recuerdo", exact: true }).click();
  await expect(page.getByText("La empresa de prueba vende escritorios.", { exact: true })).toBeVisible();
  expect(operations.filter(item => item.action === "update")).toEqual([expect.objectContaining({ project: "empresa", id: "fixture-company", memory: expect.objectContaining({ source: "correction" }) })]);
  // Simulated remote state persists across reload; not a claim about live Neon.
  await page.reload();
  await page.getByRole("button", { name: "Memoria", exact: true }).click();
  await page.getByRole("button", { name: /📁 empresa/ }).click();
  await expect(page.getByText("La empresa de prueba vende escritorios.", { exact: true })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Olvidar", exact: true }).click();
  await expect(page.getByText("La empresa de prueba vende escritorios.", { exact: true })).not.toBeVisible();
  expect(operations.filter(item => item.action === "forget")).toEqual([expect.objectContaining({ project: "empresa", id: "fixture-company" })]);
  fail = true;
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.getByText("Fallo controlado de memoria", { exact: true })).toBeVisible();
});

test("agent receipts errors and mission approval transitions are explicit", async ({ page, context }) => {
  await owner(page, context);
  const runs: { agent: string; project: string; use_memory: boolean; prompt: string }[] = [];
  let quota = false;
  await page.route("**/api/backend/agents/run", async route => {
    const body = route.request().postDataJSON(); runs.push(body);
    expect(body.agent).toBe("organization"); expect(body.project).toBe("personal"); expect(body.use_memory).toBe(false); expect(body).not.toHaveProperty("owner");
    if (quota) return route.fulfill({ status: 429, json: { error: "Cuota controlada agotada" } });
    return route.fulfill({ json: { provider: "gemini", text: body.prompt.startsWith("Propón") ? "Propuesta de prueba: revisar el catálogo aportado." : "Resultado de agente controlado.", run: { id: "fixture-run", state: "completed", tools: ["gemini.generate"], memory_ids: [], audit_persisted: true }, document_truncated: false } });
  });
  let mission = { id: "fixture-mission", goal: "Revisar recuerdos del proyecto", state: "pending_approval", approval: null as { actor: string; at: string } | null, checkpoints: [] as { tool: string; verified: boolean }[] };
  const actions: string[] = []; let storageFail = false;
  await page.route("**/api/backend/missions/operate", async route => {
    const body = route.request().postDataJSON(); actions.push(body.action);
    expect(body.project).toBe("personal"); expect(body.agent).toBe("archivist");
    if (storageFail) return route.fulfill({ status: 503, json: { error: "Checkpoint no disponible: fixture" } });
    if (body.action === "list") return route.fulfill({ json: [mission] });
    if (body.action === "create") mission = { ...mission, goal: body.goal };
    if (body.action === "approve") mission = { ...mission, state: "queued", approval: { actor: "123456", at: "2026-11-22T00:00:00Z" } };
    if (body.action === "pause") mission = { ...mission, state: "paused" };
    if (body.action === "resume") mission = { ...mission, state: "queued" };
    if (body.action === "run_step") mission = { ...mission, state: "completed", checkpoints: [{ tool: "memory.recall", verified: true }] };
    return route.fulfill({ json: mission });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Agentes", exact: true }).click();
  const panel = page.getByRole("region", { name: "Agentes con herramientas" });
  await panel.getByRole("combobox", { name: "Procedimiento", exact: true }).selectOption("organization");
  await panel.getByLabel("Leer respuestas del agente en voz alta", { exact: true }).uncheck();
  await panel.getByRole("textbox", { name: "Objetivo del agente", exact: true }).fill("Organiza el material aportado.");
  expect(runs).toHaveLength(0);
  await panel.getByRole("button", { name: "Ejecutar consulta autorizada", exact: true }).click();
  await expect(panel.getByText("Resultado de agente controlado.", { exact: true })).toBeVisible();
  await expect(panel.getByText(/Herramientas confirmadas: gemini.generate/)).toBeVisible();
  await expect(panel.getByText(/Recibo guardado en Neon/)).toBeVisible(); expect(runs).toHaveLength(1);
  quota = true;
  await panel.getByRole("button", { name: "Ejecutar consulta autorizada", exact: true }).click();
  await expect(panel.getByRole("alert")).toHaveText("Cuota controlada agotada");
  await expect(panel.getByText(/Recibo guardado en Neon/)).not.toBeVisible();
  quota = false;
  await page.getByRole("button", { name: "Misiones", exact: true }).click();
  await page.getByRole("button", { name: "Pedir propuestas a Gemini", exact: true }).click();
  await expect(page.getByText("Propuesta de prueba: revisar el catálogo aportado.", { exact: true })).toBeVisible(); expect(actions).toHaveLength(0);
  await page.getByRole("textbox", { name: "Meta autorizada", exact: true }).fill("Revisar recuerdos del proyecto");
  await page.getByRole("button", { name: "Crear plan de revisión de memoria", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ejecutar un paso autorizado", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Aprobar plan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ejecutar un paso autorizado", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ejecutar un paso autorizado", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Reanudar (encolar)", exact: true }).click();
  await page.getByRole("button", { name: "Ejecutar un paso autorizado", exact: true }).click();
  await expect(page.getByText(/Completada · checkpoints: 1/)).toBeVisible(); expect(actions).toEqual(["create", "approve", "pause", "resume", "run_step"]);
  storageFail = true;
  await page.getByRole("button", { name: "Cargar checkpoints", exact: true }).click();
  await expect(page.getByText("Checkpoint no disponible: fixture", { exact: true })).toBeVisible();
});

test("new memory agent and mission routes require owner authentication", async ({ request }) => {
  expect((await request.get("/api/backend/agents/tools")).status()).toBe(401);
  for (const path of ["memory/operate", "agents/run", "missions/operate"]) expect((await request.post(`/api/backend/${path}`, { data: {} })).status()).toBe(401);
});
