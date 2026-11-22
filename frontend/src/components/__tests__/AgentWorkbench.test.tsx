import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import AgentWorkbench from "../AgentWorkbench";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("requires explicit memory consent and never starts an agent on mount", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ provider: "gemini", text: "Resultado controlado", run: { id: "unit-run", state: "completed", tools: ["memory.recall", "gemini.generate"], memory_ids: ["id"], audit_persisted: true } })));
  render(<AgentWorkbench />);
  fireEvent.change(screen.getByLabelText("Objetivo del agente"), { target: { value: "Revisa mi presupuesto" } });
  const run = screen.getByRole("button", { name: "Ejecutar consulta autorizada" });
  expect(run).toBeDisabled(); expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText(/Autorizar la consulta de recuerdos/));
  fireEvent.click(run);
  await screen.findByText("Resultado controlado");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Recibo guardado en Neon/)).toBeInTheDocument();
});
it("keeps failed agent operations visible without inventing successful tools", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Cuota agotada" }, { status: 429 })));
  render(<AgentWorkbench />);
  fireEvent.change(screen.getByLabelText("Procedimiento"), { target: { value: "organization" } });
  fireEvent.change(screen.getByLabelText("Objetivo del agente"), { target: { value: "Organiza mi día" } });
  fireEvent.click(screen.getByRole("button", { name: "Ejecutar consulta autorizada" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Cuota agotada");
  expect(screen.queryByText(/Recibo guardado/)).not.toBeInTheDocument();
});

it("reads the real protocol result after an explicit run without adding a second model request", async () => {
  const spoken: { text: string }[] = [];
  vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
  vi.stubGlobal("speechSynthesis", { getVoices: () => [], addEventListener: vi.fn(), removeEventListener: vi.fn(), cancel: vi.fn(), resume: vi.fn(), speak: (u: { text: string }) => spoken.push(u) });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ provider: "gemini", text: "Tu presupuesto es cero.", run: { id: "voice-unit", state: "completed", tools: ["gemini.generate"], memory_ids: [], audit_persisted: true } })));
  render(<AgentWorkbench />);
  fireEvent.change(screen.getByLabelText("Procedimiento"), { target: { value: "organization" } });
  fireEvent.change(screen.getByLabelText("Objetivo del agente"), { target: { value: "Organiza" } });
  fireEvent.click(screen.getByRole("button", { name: "Ejecutar consulta autorizada" }));
  await screen.findByText("Tu presupuesto es cero.");
  expect(spoken.some((u) => u.text.includes("Tu presupuesto es cero."))).toBe(true);
  expect(fetch).toHaveBeenCalledTimes(1);
});
