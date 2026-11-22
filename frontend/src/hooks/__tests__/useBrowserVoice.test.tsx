import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useBrowserVoice } from "../useBrowserVoice";
class Recognition {
  static instances: Recognition[] = [];
  lang = "";
  continuous = true;
  interimResults = false;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onresult:
    | ((event: {
        results: {
          length: number;
          [n: number]: { [n: number]: { transcript: string } };
        };
      }) => void)
    | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() {
    Recognition.instances.push(this);
  }
}
class Utterance {
  lang = "";
  voice: unknown;
  rate = 1;
  pitch = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onboundary: (() => void) | null = null;
  constructor(public text: string) {}
}
const spanish = {
  voiceURI: "es-jorge",
  lang: "es-ES",
  name: "Jorge",
  localService: true,
};
const spoken: Utterance[] = [];
const synth = {
  speak: vi.fn((item: Utterance) => {
    spoken.push(item);
  }),
  cancel: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(() => [spanish]),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  Recognition.instances = [];
  spoken.length = 0;
  vi.stubGlobal("SpeechRecognition", undefined);
  vi.stubGlobal("webkitSpeechRecognition", Recognition);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("speechSynthesis", synth);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("never starts a microphone on mount, mode toggle, or without consent", async () => {
  const { result } = renderHook(() => useBrowserVoice());
  await waitFor(() => expect(result.current.supported).toBe(true));
  expect(Recognition.instances).toHaveLength(0);
  act(() => result.current.setMode(true));
  act(() => result.current.listen("", vi.fn()));
  expect(Recognition.instances).toHaveLength(0);
  act(() => result.current.setConsent(true));
  expect(Recognition.instances).toHaveLength(0);
});
it("transcribes Spanish through the WebKit API, preserves a draft and stops on withdrawal", async () => {
  const { result } = renderHook(() => useBrowserVoice());
  await waitFor(() => expect(result.current.supported).toBe(true));
  const update = vi.fn();
  act(() => {
    result.current.setMode(true);
    result.current.setConsent(true);
  });
  act(() => result.current.listen("Mi borrador.", update));
  const instance = Recognition.instances[0];
  expect(instance.lang).toBe("es-ES");
  expect(instance.continuous).toBe(false);
  act(() => instance.onstart?.());
  expect(result.current.listening).toBe(true);
  act(() =>
    instance.onresult?.({
      results: { length: 1, 0: { 0: { transcript: "Jarvis, buenos días" } } },
    }),
  );
  expect(update).toHaveBeenLastCalledWith("Mi borrador. Jarvis, buenos días");
  act(() => result.current.finishListening());
  expect(instance.stop).toHaveBeenCalledTimes(1);
  act(() => result.current.setConsent(false));
  expect(instance.abort).toHaveBeenCalled();
  expect(instance.onresult).toBeNull();
  expect(result.current.listening).toBe(false);
});
it("shows permission errors without restarting recognition", async () => {
  const { result } = renderHook(() => useBrowserVoice());
  await waitFor(() => expect(result.current.supported).toBe(true));
  act(() => {
    result.current.setMode(true);
    result.current.setConsent(true);
  });
  act(() => result.current.listen("", vi.fn()));
  act(() => Recognition.instances[0].onerror?.({ error: "not-allowed" }));
  expect(result.current.error).toContain("Permiso de micrófono denegado");
  expect(result.current.starting).toBe(false);
  expect(result.current.listening).toBe(false);
  expect(Recognition.instances).toHaveLength(1);
});
it("bounds listening and does not reconnect automatically", async () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useBrowserVoice());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  act(() => {
    result.current.setMode(true);
    result.current.setConsent(true);
  });
  act(() => result.current.listen("", vi.fn()));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(45000);
  });
  expect(result.current.error).toContain("45 segundos");
  expect(Recognition.instances[0].abort).toHaveBeenCalled();
  expect(Recognition.instances).toHaveLength(1);
});
it("marks speaking only after a real start event, reacts to boundaries, and silences", async () => {
  const { result } = renderHook(() => useBrowserVoice());
  await waitFor(() => expect(result.current.speechSupported).toBe(true));
  act(() => result.current.setMode(true));
  act(() => result.current.speak("Respuesta real recibida"));
  expect(result.current.speaking).toBe(false);
  expect(spoken[0].voice).toEqual(spanish);
  act(() => spoken[0].onstart?.());
  expect(result.current.speaking).toBe(true);
  act(() => spoken[0].onboundary?.());
  expect(result.current.beat).toBe(true);
  act(() => result.current.setMuted(true));
  expect(result.current.speaking).toBe(false);
  expect(synth.cancel).toHaveBeenCalled();
  act(() => result.current.speak("No debe hablar"));
  expect(spoken).toHaveLength(1);
});
it("cancels playback before listening and ignores stale audio callbacks", async () => {
  const { result } = renderHook(() => useBrowserVoice());
  await waitFor(() => expect(result.current.supported).toBe(true));
  act(() => {
    result.current.setMode(true);
    result.current.setConsent(true);
  });
  act(() => result.current.speak("Hola"));
  const item = spoken[0];
  act(() => item.onstart?.());
  const cancelBefore = synth.cancel.mock.calls.length;
  act(() => result.current.listen("", vi.fn()));
  expect(synth.cancel.mock.calls.length).toBeGreaterThan(cancelBefore);
  act(() => item.onend?.());
  expect(result.current.speaking).toBe(false);
  expect(Recognition.instances).toHaveLength(1);
});
it("offers a clear manual playback fallback when Safari blocks delayed speech", async () => {
  vi.useFakeTimers();
  const { result } = renderHook(() => useBrowserVoice());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  act(() => result.current.setMode(true));
  act(() => result.current.speak("Hola"));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3000);
  });
  expect(result.current.error).toContain("Pulsa Reproducir respuesta");
  expect(result.current.speaking).toBe(false);
});
it("cancels microphone and speech on unmount without saving audio", async () => {
  const { result, unmount } = renderHook(() => useBrowserVoice());
  await waitFor(() => expect(result.current.supported).toBe(true));
  act(() => {
    result.current.setMode(true);
    result.current.setConsent(true);
  });
  act(() => result.current.listen("", vi.fn()));
  unmount();
  expect(Recognition.instances[0].abort).toHaveBeenCalled();
  expect(synth.cancel).toHaveBeenCalled();
});

it("speaks readable prose without Markdown symbols or code blocks", async () => {
  const { result } = renderHook(() => useBrowserVoice());
  await waitFor(() => expect(result.current.speechSupported).toBe(true));
  act(() => result.current.setMode(true));
  act(() => result.current.speak("### Buenos días\n**Presupuesto $0**. [Documento](https://example.com). ```token=secreto```"));
  expect(spoken[0].text).not.toMatch(/[#*`]|token=|https:/);
  expect(spoken[0].text).toContain("Buenos días");
  expect(spoken[0].text).toContain("Código disponible en pantalla");
});
