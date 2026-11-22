import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useBrowserVoice } from "../useBrowserVoice";

// Explicit native-engine fixtures. No assertion of physical speaker output.
class Utterance {
  voice?: unknown;
  onstart?: () => void; onend?: () => void;
  onerror?: (event: { error: string }) => void;
  constructor(public text: string) {}
}
const spoken: Utterance[] = [];
const spanish = { voiceURI: "downloadable-voice", name: "Jorge", lang: "es-ES", localService: true };
beforeEach(() => {
  spoken.length = 0;
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("speechSynthesis", {
    getVoices: () => [spanish], addEventListener: vi.fn(), removeEventListener: vi.fn(), cancel: vi.fn(), resume: vi.fn(),
    speak: (item: Utterance) => spoken.push(item),
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("retries an unavailable selected voice once with the native Spanish default", async () => {
  const { result } = renderHook(() => useBrowserVoice());
  await waitFor(() => expect(result.current.speechSupported).toBe(true));
  const completed = vi.fn();
  act(() => { result.current.setMode(true); result.current.speak("Respuesta original de Gemini.", completed); });
  const initial = spoken[0];
  expect(initial.voice).toEqual(spanish);
  act(() => initial.onerror?.({ error: "voice-unavailable" }));
  expect(spoken).toHaveLength(2);
  expect(spoken[1].voice).toBeUndefined();
  expect(spoken[1].text).toBe(initial.text);
  act(() => { initial.onstart?.(); initial.onend?.(); });
  expect(completed).not.toHaveBeenCalled();
  act(() => { spoken[1].onstart?.(); spoken[1].onend?.(); });
  expect(completed).toHaveBeenCalledTimes(1);
  expect(result.current.error).toBe("");
});

it("does not loop when the native default also fails", async () => {
  const { result } = renderHook(() => useBrowserVoice());
  await waitFor(() => expect(result.current.speechSupported).toBe(true));
  act(() => { result.current.setMode(true); result.current.speak("Texto conservado."); });
  act(() => spoken[0].onerror?.({ error: "synthesis-failed" }));
  act(() => spoken[1].onerror?.({ error: "synthesis-failed" }));
  expect(spoken).toHaveLength(2);
  expect(result.current.error).toContain("Reactivar voz");
  expect(result.current.speechPending).toBe(false);
});

it("keeps the working default for later chunks instead of retrying a broken voice", async () => {
  const { result } = renderHook(() => useBrowserVoice());
  await waitFor(() => expect(result.current.speechSupported).toBe(true));
  act(() => { result.current.setMode(true); result.current.speak("Una respuesta larga conserva la misma voz. ".repeat(6)); });
  act(() => spoken[0].onerror?.({ error: "voice-unavailable" }));
  act(() => { spoken[1].onstart?.(); spoken[1].onend?.(); });
  expect(spoken).toHaveLength(3);
  expect(spoken[2].voice).toBeUndefined();
});

it("requires a new user gesture after permission denial and never retries a partial reading", async () => {
  const { result } = renderHook(() => useBrowserVoice());
  await waitFor(() => expect(result.current.speechSupported).toBe(true));
  act(() => { result.current.setMode(true); result.current.speak("Respuesta conservada."); });
  act(() => spoken[0].onerror?.({ error: "not-allowed" }));
  expect(spoken).toHaveLength(1);
  expect(result.current.error).toContain("Safari bloqueó");
  act(() => result.current.speak("Una nueva lectura."));
  act(() => { spoken[1].onstart?.(); spoken[1].onerror?.({ error: "synthesis-failed" }); });
  expect(spoken).toHaveLength(2);
  expect(result.current.speaking).toBe(false);
});
