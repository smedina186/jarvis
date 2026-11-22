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
