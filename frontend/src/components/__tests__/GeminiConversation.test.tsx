import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import GeminiConversation, { type GeminiStatus } from "../GeminiConversation";
const status: GeminiStatus = {
  state: "configured",
  enabled: true,
  verified: false,
  detail: "Clave configurada, sin validar",
  model: "gemini-3.5-flash-lite",
};
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
it("does not call Gemini on mount and stays closed until explicitly enabled", () => {
  render(
    <GeminiConversation
      status={{ ...status, enabled: false }}
      onStatus={vi.fn()}
    />,
  );
  expect(
    screen.getByRole("textbox", { name: "Mensaje a JARVIS" }),
  ).toBeDisabled();
  expect(fetch).not.toHaveBeenCalled();
});
it("sends a real protocol request only on submit and renders the provider response safely", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      provider: "gemini",
      text: "Respuesta de prueba <script>no ejecutar</script>",
    }),
  );
  const change = vi.fn();
  render(<GeminiConversation status={status} onStatus={change} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "hola" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar mensaje a Gemini" }),
  );
  await screen.findByText("Respuesta de prueba <script>no ejecutar</script>");
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch).toHaveBeenCalledWith(
    "/api/backend/chat",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", text: "hola" }] }),
    }),
  );
  expect(document.querySelector("script")).toBeNull();
  expect(change).toHaveBeenCalled();
});
it("shows quota errors, preserves the draft and does not retry automatically", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json(
      { error: "Cuota agotada" },
      { status: 429, headers: { "Retry-After": "60" } },
    ),
  );
  render(<GeminiConversation status={status} onStatus={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "hola" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar mensaje a Gemini" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Cuota agotada");
  expect(screen.getByRole("textbox")).toHaveValue("hola");
  expect(
    screen.getByRole("button", { name: "Enviar mensaje a Gemini" }),
  ).toBeDisabled();
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("lets the user stop a pending request without freezing the page", async () => {
  vi.mocked(fetch).mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("abort", "AbortError")),
        );
      }),
  );
  render(<GeminiConversation status={status} onStatus={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "hola" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar mensaje a Gemini" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Detener solicitud" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Solicitud detenida",
  );
  await waitFor(() => expect(screen.getByRole("textbox")).toBeEnabled());
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("ends a stalled request at the deadline without retrying", async () => {
  vi.useFakeTimers();
  vi.mocked(fetch).mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("abort", "AbortError")),
        );
      }),
  );
  render(<GeminiConversation status={status} onStatus={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "hola" } });
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar mensaje a Gemini" }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(28000);
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "tiempo de espera agotado",
  );
  expect(screen.getByRole("textbox")).toBeEnabled();
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("provides keyboard dictation fallback without starting a microphone or sending", async () => {
  vi.stubGlobal("SpeechRecognition", undefined);
  vi.stubGlobal("webkitSpeechRecognition", undefined);
  render(<GeminiConversation status={status} onStatus={vi.fn()} />);
  fireEvent.click(screen.getByRole("switch", { name: "Modo voz" }));
  expect(
    screen.getByText(/Este navegador no ofrece reconocimiento directo/),
  ).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Usar dictado del teclado" }),
  );
  expect(screen.getByRole("textbox")).toHaveFocus();
  expect(fetch).not.toHaveBeenCalled();
});

it("requires review and one submit after dictation, then reads only the received Gemini text", async () => {
  class Recognition {
    static instance: Recognition;
    onresult:
      | ((event: {
          results: {
            length: number;
            [n: number]: { [n: number]: { transcript: string } };
          };
        }) => void)
      | null = null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();
    constructor() {
      Recognition.instance = this;
    }
  }
  class Utterance {
    onstart: (() => void) | null = null;
    constructor(public text: string) {}
  }
  const speak = vi.fn();
  vi.stubGlobal("SpeechRecognition", undefined);
  vi.stubGlobal("webkitSpeechRecognition", Recognition);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("speechSynthesis", {
    speak,
    cancel: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  let resolve!: (response: Response) => void;
  vi.mocked(fetch).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const activity = vi.fn();
  render(
    <GeminiConversation
      status={status}
      onStatus={vi.fn()}
      onActivity={activity}
    />,
  );
  fireEvent.click(screen.getByRole("switch", { name: "Modo voz" }));
  expect(
    screen.getByRole("button", { name: "Iniciar dictado" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByLabelText("Acepto usar el reconocimiento de voz del navegador"),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Iniciar dictado" }),
    ).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Iniciar dictado" }));
  act(() => Recognition.instance.onstart?.());
  act(() =>
    Recognition.instance.onresult?.({
      results: { length: 1, 0: { 0: { transcript: "Jarvis, buenos días" } } },
    }),
  );
  expect(screen.getByRole("textbox")).toHaveValue("Jarvis, buenos días");
  expect(fetch).not.toHaveBeenCalled();
  act(() => Recognition.instance.onend?.());
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "Jarvis, buenos días. ¿Cómo estás?" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar mensaje a Gemini" }),
  );
  fireEvent.submit(screen.getByRole("textbox").closest("form")!);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(activity).toHaveBeenCalledWith("processing");
  await act(async () => {
    resolve(
      Response.json({
        provider: "gemini",
        text: "Buenos días. Estoy listo para ayudarte.",
      }),
    );
  });
  expect(speak).toHaveBeenCalledTimes(1);
  expect(speak.mock.calls[0][0].text.trim()).toBe(
    "Buenos días. Estoy listo para ayudarte.",
  );
  act(() => speak.mock.calls[0][0].onstart?.());
  expect(activity).toHaveBeenCalledWith("speaking");
  fireEvent.click(screen.getByRole("button", { name: "Detener voz" }));
  expect(fetch).toHaveBeenCalledTimes(1);
});
