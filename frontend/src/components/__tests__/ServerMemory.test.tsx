import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ServerMemory from "../ServerMemory";
import ServerMissions from "../ServerMissions";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("shows pending storage without enabling writes or claiming Memanto is connected", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          state: "pending",
          durable: false,
          memanto: "prepared_not_connected",
          reason: "Sin proveedor autorizado",
        }),
      ),
  );
  render(<ServerMemory />);
  await screen.findByText("Sin proveedor autorizado");
  expect(
    screen.getByRole("button", { name: "Guardar recuerdo" }),
  ).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Borrar toda mi memoria del servidor" }),
  ).toBeDisabled();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("does not pretend a mission was created when storage rejects the operation", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: "Almacenamiento pendiente" }, { status: 503 }),
      ),
  );
  render(<ServerMissions />);
  fireEvent.change(screen.getByLabelText("Meta autorizada"), {
    target: { value: "Revisar mi proyecto" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Crear plan de revisión de memoria" }),
  );
  await waitFor(() =>
    expect(screen.getByText("Almacenamiento pendiente")).toBeInTheDocument(),
  );
  expect(
    screen.queryByRole("button", { name: "Aprobar plan" }),
  ).not.toBeInTheDocument();
});

it("automatically loads real protocol records into project folders and acknowledges refresh", async () => {
  const record = { id: "id1", content: "Presupuesto $0", state: "active", kind: "preference", source: "explicit", conflicts: [] };
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    if (url === "/api/backend/memory/status") return Response.json({ state: "active", memanto: "prepared_not_connected" });
    const action = JSON.parse(init.body).action;
    return Response.json(action === "projects" ? ["personal", "empresa"] : [record]);
  }));
  render(<ServerMemory />);
  expect(await screen.findByText("Presupuesto $0")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /empresa/ })).toBeEnabled();
  expect(screen.getByText("Conexión comprobada. Recuerdos cargados desde Neon.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Comprobar memoria" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(6));
});

it("requests mission recommendations from Gemini only after a user action, without executing a mission", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ provider: "gemini", text: "Revisa el objetivo de ventas aportado." })));
  render(<ServerMissions geminiEnabled />);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Pedir propuestas a Gemini" }));
  expect(await screen.findByText("Revisa el objetivo de ventas aportado.")).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/backend/agents/run");
  expect(screen.queryByRole("button", { name: "Aprobar plan" })).not.toBeInTheDocument();
});
