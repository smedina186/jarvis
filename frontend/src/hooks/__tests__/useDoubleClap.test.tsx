import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useDoubleClap } from "../useDoubleClap";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("never acquires audio before opt-in and releases capture when speech takes over", async () => {
  const stop = vi.fn(), close = vi.fn().mockResolvedValue(undefined);
  const gum = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: gum } });
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("AudioContext", class { state = "running"; resume = vi.fn().mockResolvedValue(undefined); close = close;
    createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
    createAnalyser() { return { fftSize: 1024, getFloatTimeDomainData: vi.fn() }; }
  });
  const { result, rerender } = renderHook(({ allowed }) => useDoubleClap(vi.fn(), allowed), { initialProps: { allowed: true } });
  expect(gum).not.toHaveBeenCalled();
  act(() => result.current.enable());
  await waitFor(() => expect(gum).toHaveBeenCalledTimes(1));
  rerender({ allowed: false });
  await waitFor(() => expect(stop).toHaveBeenCalled());
  expect(result.current.state).toContain("Pausado");
  act(() => result.current.disable());
  await waitFor(() => expect(close).toHaveBeenCalled());
});
it("releases a permission result that arrives after disabling", async () => {
  const stop = vi.fn();
  let resolve!: (stream: unknown) => void;
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(() => new Promise((r) => { resolve = r; })) } });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("AudioContext", class { state = "running"; resume = vi.fn().mockResolvedValue(undefined); close = vi.fn().mockResolvedValue(undefined); });
  const { result } = renderHook(() => useDoubleClap(vi.fn(), true));
  act(() => result.current.enable());
  act(() => result.current.disable());
  await act(async () => { resolve({ getTracks: () => [{ stop }] }); });
  expect(stop).toHaveBeenCalled();
});
