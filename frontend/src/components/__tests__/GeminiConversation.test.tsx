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
  ).toBeEnabled();
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
  fireEvent.change(screen.getByRole("textbox", { name: "Mensaje a JARVIS" }), {
    target: { value: "hola" },
  });
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
  fireEvent.change(screen.getByRole("textbox", { name: "Mensaje a JARVIS" }), {
    target: { value: "hola" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar mensaje a Gemini" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent("Cuota agotada");
  expect(screen.getByRole("textbox", { name: "Mensaje a JARVIS" })).toHaveValue(
    "hola",
  );
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
  fireEvent.change(screen.getByRole("textbox", { name: "Mensaje a JARVIS" }), {
    target: { value: "hola" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar mensaje a Gemini" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Detener solicitud" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Solicitud detenida",
  );
  await waitFor(() =>
    expect(
      screen.getByRole("textbox", { name: "Mensaje a JARVIS" }),
    ).toBeEnabled(),
  );
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
  fireEvent.change(screen.getByRole("textbox", { name: "Mensaje a JARVIS" }), {
    target: { value: "hola" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar mensaje a Gemini" }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(28000);
  });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "tiempo de espera agotado",
  );
  expect(
    screen.getByRole("textbox", { name: "Mensaje a JARVIS" }),
  ).toBeEnabled();
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
  expect(
    screen.getByRole("textbox", { name: "Mensaje a JARVIS" }),
  ).toHaveFocus();
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
  expect(screen.getByRole("textbox", { name: "Mensaje a JARVIS" })).toHaveValue(
    "Jarvis, buenos días",
  );
  expect(fetch).not.toHaveBeenCalled();
  act(() => Recognition.instance.onend?.());
  fireEvent.change(screen.getByRole("textbox", { name: "Mensaje a JARVIS" }), {
    target: { value: "Jarvis, buenos días. ¿Cómo estás?" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar mensaje a Gemini" }),
  );
  fireEvent.submit(
    screen.getByRole("textbox", { name: "Mensaje a JARVIS" }).closest("form")!,
  );
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

it("can dictate without Render and sends an automatic turn only after explicit session start", async () => {
  class Recognition {
    static instances: Recognition[] = [];
    onresult: ((event: unknown) => void) | null = null;
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    start = vi.fn();
    stop = vi.fn();
    abort = vi.fn();
    constructor() {
      Recognition.instances.push(this);
    }
  }
  class Utterance {
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    constructor(public text: string) {}
  }
  const spoken: Utterance[] = [];
  vi.stubGlobal("SpeechRecognition", undefined);
  vi.stubGlobal("webkitSpeechRecognition", Recognition);
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("speechSynthesis", {
    speak: (u: Utterance) => spoken.push(u),
    cancel: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      provider: "gemini",
      text: "Respuesta real del transporte de prueba",
    }),
  );
  const view = render(<GeminiConversation status={null} onStatus={vi.fn()} />);
  fireEvent.click(screen.getByRole("switch", { name: "Modo voz" }));
  fireEvent.click(
    screen.getByLabelText("Acepto usar el reconocimiento de voz del navegador"),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Iniciar dictado" }),
    ).toBeEnabled(),
  );
  expect(
    screen.getByRole("button", { name: "Enviar mensaje a Gemini" }),
  ).toBeDisabled();
  view.rerender(<GeminiConversation status={status} onStatus={vi.fn()} />);
  fireEvent.click(
    screen.getByRole("button", { name: "Iniciar conversación automática" }),
  );
  expect(Recognition.instances).toHaveLength(0);
  expect(spoken[0].text).toBe("Te escucho.");
  vi.useFakeTimers();
  act(() => { spoken[0].onstart?.(); spoken[0].onend?.(); });
  const first = Recognition.instances[0];
  act(() => {
    first.onstart?.();
    first.onresult?.({
      results: {
        length: 1,
        0: { 0: { transcript: "Oye Jarvis, buenos días" } },
      },
    });
  });
  expect(fetch).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2799);
  });
  expect(fetch).not.toHaveBeenCalled();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(
    JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string).messages[0]
      .text,
  ).toBe("buenos días");
  expect(spoken).toHaveLength(2);
  act(() => {
    spoken[1].onstart?.();
    spoken[1].onend?.();
  });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  expect(Recognition.instances).toHaveLength(2);
  expect(fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Detener conversación" }));
  expect(Recognition.instances[1].abort).toHaveBeenCalled();
});

it("runs the optional daily review once per day and stores the real test response encrypted", async () => {
  const { webcrypto } = await import("node:crypto");
  vi.stubGlobal("crypto", webcrypto);
  vi.useFakeTimers();
  localStorage.clear();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (
        _name: string,
        _options: unknown,
        run: (lock: object) => Promise<void>,
      ) => run({}),
    },
  });
  vi.mocked(fetch).mockImplementation(async (url) =>
    url === "/api/memory/key"
      ? Response.json({
          owner: "123",
          key: Buffer.alloc(32, 8).toString("base64"),
        })
      : Response.json({
          provider: "gemini",
          text: "Propuestas reales del transporte de prueba",
        }),
  );
  const first = render(
    <GeminiConversation status={status} onStatus={vi.fn()} />,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByLabelText(/Autorizar una revisión gratuita al día/),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(
    vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/backend/chat"),
  ).toHaveLength(1);
  // Crypto completes outside fake timers; flush its actual promise before leaving.
  await act(async () => {
    await new Promise((resolve) =>
      webcrypto.subtle.digest("SHA-256", new Uint8Array()).then(resolve),
    );
  });
  first.unmount();
  render(<GeminiConversation status={status} onStatus={vi.fn()} />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
  expect(
    vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/backend/chat"),
  ).toHaveLength(1);
  localStorage.clear();
  delete (navigator as unknown as Record<string, unknown>).locks;
});

it("opens a voice session from one explicit tap and honors rejected consent", async () => {
  class Recognition {
    start = vi.fn(); stop = vi.fn(); abort = vi.fn();
    constructor() { instances.push(this); }
  }
  const instances: Recognition[] = [];
  vi.stubGlobal("webkitSpeechRecognition", Recognition);
  vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
  render(<GeminiConversation status={status} onStatus={vi.fn()} />);
  const button = screen.getByRole("button", { name: "Hablar con JARVIS" });
  await waitFor(() => expect(button).toBeEnabled());
  // Wait for feature detection, then deny the first request.
  await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  fireEvent.click(button);
  expect(instances).toHaveLength(0);
  fireEvent.click(button);
  expect(instances).toHaveLength(1);
  expect(instances[0].start).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Detener conversación" }));
  expect(instances[0].abort).toHaveBeenCalledTimes(1);
  vi.restoreAllMocks();
});

it("retains the owner's text before a failed request and excludes failed turns from retry context", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: "Sin conexión" }, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ provider: "gemini", text: "Ahora sí recibí tu frase." }));
  render(<GeminiConversation status={status} onStatus={vi.fn()} />);
  const draft = screen.getByRole("textbox", { name: "Mensaje a JARVIS" });
  fireEvent.change(draft, { target: { value: "No pierdas esta frase" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje a Gemini" }));
  expect(await screen.findByText(/Texto conservado. No se recibió respuesta/)).toBeInTheDocument();
  expect(draft).toHaveValue("No pierdas esta frase");
  expect(screen.getByText("No pierdas esta frase", { selector: "p" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje a Gemini" }));
  await screen.findByText("Ahora sí recibí tu frase.");
  expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string).messages).toEqual([{ role: "user", text: "No pierdas esta frase" }]);
});

it("recovers blocked device speech from a fresh tap without resending the received Gemini answer", async () => {
  // Unit integration: the HTTP result and native speech events are fixtures.
  // This checks recovery wiring; it does not claim an audible iPad test.
  class Utterance {
    onstart: (() => void) | null = null;
    onend: (() => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;
    constructor(public text: string) {}
  }
  const spoken: Utterance[] = [];
  vi.stubGlobal("SpeechSynthesisUtterance", Utterance);
  vi.stubGlobal("speechSynthesis", {
    speak: (item: Utterance) => spoken.push(item),
    cancel: vi.fn(),
    resume: vi.fn(),
    getVoices: () => [],
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  const answer = "Tu presupuesto sigue siendo cero dólares. ¿En qué proyecto trabajamos hoy?";
  vi.mocked(fetch).mockResolvedValue(Response.json({ provider: "gemini", text: answer }));
  const onStatus = vi.fn();
  render(<GeminiConversation status={status} onStatus={onStatus} />);
  fireEvent.click(screen.getByRole("switch", { name: "Modo voz" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Mensaje a JARVIS" }), {
    target: { value: "¿Qué recuerdas de mi presupuesto?" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensaje a Gemini" }));
  await screen.findByText(answer);
  expect(spoken).toHaveLength(1);
  act(() => spoken[0].onerror?.({ error: "not-allowed" }));

  expect(screen.getByRole("alert")).toHaveTextContent(/voz|audio|reproducir/i);
  expect(screen.getByText(answer)).toBeInTheDocument();
  expect(screen.getByText("¿Qué recuerdas de mi presupuesto?", { selector: "p" })).toBeInTheDocument();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(spoken).toHaveLength(1); // Never retry permission failures automatically.
  expect(onStatus).toHaveBeenCalledTimes(1);
  const receivedStatus = onStatus.mock.calls[0][0](status);
  expect(receivedStatus).toMatchObject({ state: "configured", verified: true });
  expect(receivedStatus.detail).toContain("contenido no auditado");

  fireEvent.click(screen.getByRole("button", { name: "Reactivar voz" }));
  expect(spoken).toHaveLength(2);
  expect(spoken[1].text.trim()).toBe(answer);
  expect(fetch).toHaveBeenCalledTimes(1);
  act(() => { spoken[1].onstart?.(); spoken[1].onend?.(); });
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("button", { name: "Reactivar voz" })).toBeNull();
  expect(onStatus).toHaveBeenCalledTimes(1);
});
