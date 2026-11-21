import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import GeminiConversation, { type GeminiStatus } from "../GeminiConversation";
const status: GeminiStatus = { state: "configured", enabled: true, verified: false, detail: "Clave configurada, sin validar", model: "gemini-3.5-flash-lite" };
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
beforeEach(() => { vi.stubGlobal("fetch", vi.fn()); });
it("does not call Gemini on mount and stays closed until explicitly enabled", () => {
  render(<GeminiConversation status={{ ...status, enabled: false }} onStatus={vi.fn()}/>);
  expect(screen.getByRole("textbox", { name: "Mensaje a JARVIS" })).toBeDisabled();
  expect(fetch).not.toHaveBeenCalled();
});
it("sends a real protocol request only on submit and renders the provider response safely", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ provider: "gemini", text: "Respuesta de prueba <script>no ejecutar</script>" }));
  const change = vi.fn();
  render(<GeminiConversation status={status} onStatus={change}/>);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "hola" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje a Gemini" }));
  await screen.findByText("Respuesta de prueba <script>no ejecutar</script>");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith("/api/backend/chat", expect.objectContaining({ method: "POST", body: JSON.stringify({ messages: [{ role: "user", text: "hola" }] }) }));
  expect(document.querySelector("script")).toBeNull();
  expect(change).toHaveBeenCalled();
});
it("shows quota errors, preserves the draft and does not retry automatically", async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ error: "Cuota agotada" }, { status: 429, headers: { "Retry-After": "60" } }));
  render(<GeminiConversation status={status} onStatus={vi.fn()}/>);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "hola" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje a Gemini" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Cuota agotada");
  expect(screen.getByRole("textbox")).toHaveValue("hola");
  expect(screen.getByRole("button", { name: "Enviar mensaje a Gemini" })).toBeDisabled();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("lets the user stop a pending request without freezing the page", async () => {
  vi.mocked(fetch).mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("abort", "AbortError")));
  }));
  render(<GeminiConversation status={status} onStatus={vi.fn()}/>);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "hola" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje a Gemini" }));
  fireEvent.click(await screen.findByRole("button", { name: "Detener solicitud" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Solicitud detenida");
  await waitFor(() => expect(screen.getByRole("textbox")).toBeEnabled());
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("ends a stalled request at the deadline without retrying", async () => {
  vi.useFakeTimers();
  vi.mocked(fetch).mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("abort", "AbortError")));
  }));
  render(<GeminiConversation status={status} onStatus={vi.fn()}/>);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "hola" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje a Gemini" }));
  await act(async () => { await vi.advanceTimersByTimeAsync(28000); });
  expect(screen.getByRole("alert")).toHaveTextContent("tiempo de espera agotado");
  expect(screen.getByRole("textbox")).toBeEnabled();
  expect(fetch).toHaveBeenCalledTimes(1);
});
