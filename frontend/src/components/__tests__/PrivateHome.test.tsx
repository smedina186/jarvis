import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), ready: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth, signOut: vi.fn() }));
vi.mock("@/lib/private-config", () => ({
  authenticationReady: mocks.ready, ownerId: () => "123456",
}));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("@/components/PrivateDashboard", () => ({ default: () => <div>Panel privado</div> }));

import Home from "@/app/page";

describe("Private home", () => {
  beforeEach(() => { mocks.ready.mockReturnValue(true); mocks.auth.mockResolvedValue(null); });
  it("rejects missing configuration", async () => {
    mocks.ready.mockReturnValue(false);
    await expect(Home()).rejects.toThrow("redirect:/login");
  });
  it("rejects anonymous and other accounts", async () => {
    await expect(Home()).rejects.toThrow("redirect:/login");
    mocks.auth.mockResolvedValue({ user: { id: "someone-else" } });
    await expect(Home()).rejects.toThrow("redirect:/login");
  });
  it("renders the dashboard only for the owner", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "123456" } });
    render(await Home());
    expect(screen.getByText("Panel privado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });
});
