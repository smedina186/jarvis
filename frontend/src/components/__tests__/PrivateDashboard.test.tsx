import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ replace: vi.fn(), unstable: false }));
vi.mock("next/navigation", () => ({ useRouter: () => router.unstable ? { replace: router.replace } : router }));

import PrivateDashboard from "@/components/PrivateDashboard";

afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Private dashboard — phase 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    router.unstable = false;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "ok" }) }));
  });

  it("shows the personal greeting without pretending a model is connected", async () => {
    render(<PrivateDashboard />);
    expect(screen.getByRole("heading", { name: "Bienvenido, Sebastián. ¿En qué trabajamos hoy?" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Mensaje a JARVIS" })).toBeDisabled();
    expect(screen.getByText("IA sin configurar")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Backend privado conectado"));
    expect(fetch).toHaveBeenCalledWith("/api/backend/health", expect.objectContaining({ cache: "no-store" }));
  });

  it("changes tabs and keeps future features visibly inactive", () => {
    render(<PrivateDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /^Agentes$/ }));
    expect(screen.getByText("Aún no hay agentes conectados. No se ejecutarán tareas.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Misiones$/ }));
    expect(screen.getByText("No hay misiones activas")).toBeInTheDocument();
  });
  it("checks once even when the router identity changes on every render", async () => {
    router.unstable = true;
    render(<PrivateDashboard />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 60)); });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("bounds a stalled request, prevents overlap and retries only on a manual click", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn((_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })));
    render(<PrivateDashboard />);
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole("button", { name: "Comprobando…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /^Conexiones$/ }));
    expect(screen.getAllByRole("button", { name: "Comprobando…" })).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(12000); });
    expect(screen.getByRole("button", { name: "Comprobar conexión" })).toBeEnabled();
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("más de 12 segundos");
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Comprobar conexión" }));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("cancels the in-flight health request when leaving the dashboard", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal("fetch", vi.fn((_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    }));
    const view = render(<PrivateDashboard />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

});
