import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import PrivateDashboard from "@/components/PrivateDashboard";

describe("Private dashboard — phase 1", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    fireEvent.click(screen.getByRole("button", { name: "Agentes", exact: true }));
    expect(screen.getByText("Aún no hay agentes conectados. No se ejecutarán tareas.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Misiones", exact: true }));
    expect(screen.getByText("No hay misiones activas")).toBeInTheDocument();
  });
});
