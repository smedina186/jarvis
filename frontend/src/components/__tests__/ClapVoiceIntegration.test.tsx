import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import GeminiConversation from "../GeminiConversation";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("does not acquire capture while audio is queued and releases claps before the voice greeting", async () => {
  const order: string[] = [];
  const stop = vi.fn(() => order.push("capture-stop"));
  const gum = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: gum } });
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("AudioContext", class {
    state = "running";
    resume = vi.fn(async () => { this.state = "running"; });
    suspend = vi.fn(async () => { this.state = "suspended"; });
    close = vi.fn(async () => { this.state = "closed"; });
    createMediaStreamSource() { return { connect: vi.fn(), disconnect: vi.fn() }; }
    createAnalyser() { return { fftSize: 1024, getFloatTimeDomainData: vi.fn() }; }
  });
  class Recognition {
    onstart?: () => void; onend?: () => void;
    start = vi.fn(() => { order.push("recognition-start"); this.onstart?.(); });
    stop = vi.fn(() => this.onend?.()); abort = vi.fn();
  }
  class Utterance { onstart?: () => void; onend?: () => void; constructor(public text: string) {} }
  const spoken: Utterance[] = [];
  vi.stubGlobal("webkitSpeechRecognition", Recognition);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("speechSynthesis", { getVoices: () => [], addEventListener: vi.fn(), removeEventListener: vi.fn(), cancel: vi.fn(), resume: vi.fn(), speak: (u: Utterance) => { spoken.push(u); order.push("speak"); } });
  vi.stubGlobal("fetch", vi.fn());
  vi.spyOn(window, "confirm").mockReturnValue(true);
  render(<GeminiConversation status={null} onStatus={vi.fn()} />);
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  fireEvent.click(screen.getByRole("button", { name: "Activar dos aplausos" }));
  expect(spoken).toHaveLength(1);
  expect(gum).not.toHaveBeenCalled();
  act(() => { spoken[0].onstart?.(); spoken[0].onend?.(); });
  await waitFor(() => expect(gum).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByText("Escuchando dos aplausos · análisis local")).toBeInTheDocument());
  order.length = 0;
  fireEvent.click(screen.getByRole("button", { name: "Iniciar dictado" }));
  expect(order.indexOf("capture-stop")).toBeGreaterThanOrEqual(0);
  expect(order.indexOf("capture-stop")).toBeLessThan(order.indexOf("recognition-start"));
  fireEvent.click(screen.getByRole("button", { name: "Finalizar dictado" }));
  await waitFor(() => expect(gum).toHaveBeenCalledTimes(2));
  order.length = 0;
  fireEvent.click(screen.getByRole("button", { name: "Hablar con JARVIS" }));
  expect(order.indexOf("capture-stop")).toBeGreaterThanOrEqual(0);
  expect(order.indexOf("capture-stop")).toBeLessThan(order.indexOf("speak"));
  expect(fetch).not.toHaveBeenCalled();
});
