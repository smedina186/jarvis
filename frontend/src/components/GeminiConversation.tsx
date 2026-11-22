"use client";
// Reuse React and installed icons; all Gemini traffic goes through the owner-only BFF.
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  LoaderCircle,
  Mic,
  Send,
  Square,
  Play,
  Volume2,
  VolumeX,
  Keyboard,
} from "lucide-react";
import { useMemoryVault } from "@/hooks/useMemoryVault";
import { retrieveMemory } from "@/lib/memory-vault";
import PersonalMemory from "./PersonalMemory";
import { useBrowserVoice, type VoiceActivity } from "@/hooks/useBrowserVoice";
export type GeminiStatus = {
  state: "configured" | "not_configured" | "error";
  enabled: boolean;
  verified: boolean;
  detail: string;
  model: string;
};
type Message = {
  role: "user" | "assistant";
  text: string;
  provider?: "gemini" | "memory";
};
interface Props {
  status: GeminiStatus | null;
  onStatus: Dispatch<SetStateAction<GeminiStatus | null>>;
  onActivity?: Dispatch<SetStateAction<VoiceActivity>>;
  onBeat?: Dispatch<SetStateAction<boolean>>;
  visible?: boolean;
}
export default function GeminiConversation({
  status,
  onStatus,
  onActivity,
  onBeat,
  visible = true,
}: Props) {
  const vault = useMemoryVault();
  const [useServerMemory, setUseServerMemory] = useState(false);
  const [useMemory, setUseMemory] = useState(false);
  const [specialist, setSpecialist] = useState("auto");
  const [memoryReport, setMemoryReport] = useState("");
  const [routing, setRouting] = useState("");
  const [dailyEnabled, setDailyEnabled] = useState(false);
  const [dailyNote, setDailyNote] = useState(
    "Revisión diaria desactivada; no hay procesos en segundo plano.",
  );
  const [automatic, setAutomatic] = useState(false);
  const session = useRef({ active: false, turns: 0 });
  const sendLatest = useRef<
    (text?: string, agent?: string, review?: boolean) => Promise<void>
  >(async () => {});
  const listenLatest = useRef<() => void>(() => {});
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retryUntil, setRetryUntil] = useState(0);
  const [now, setNow] = useState(0);
  const active = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const voice = useBrowserVoice();
  const visibleRef = useRef(visible);
  const lastReply =
    messages.filter((message) => message.role === "assistant").at(-1)?.text ||
    "";
  useEffect(() => {
    onActivity?.(
      voice.listening || voice.starting
        ? "listening"
        : pending
          ? "processing"
          : voice.speaking
            ? "speaking"
            : "idle",
    );
  }, [voice.listening, voice.starting, voice.speaking, pending, onActivity]);
  useEffect(() => {
    onBeat?.(voice.beat);
  }, [voice.beat, onBeat]);
  useEffect(() => {
    visibleRef.current = visible;
    if (!visible) voice.stopAll();
    // Stop audio when leaving Chat; never restart when returning.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages.length, pending]);
  useEffect(() => {
    if (!retryUntil) return;
    const interval = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= retryUntil) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [retryUntil]);
  const wait = Math.max(0, Math.ceil((retryUntil - now) / 1000));
  function stopConversation() {
    session.current.active = false;
    session.current.turns = 0;
    setAutomatic(false);
    voice.stopAll();
  }
  const startVoiceLatest = useRef<() => void>(() => {});
  function startVoiceSession() {
    if (automatic) { stopConversation(); active.current?.abort(); return; }
    if (!voice.supported) {
      input.current?.focus();
      setError("Safari no ofrece reconocimiento directo aquí. Pulsa el micrófono del teclado del iPad para dictar; JARVIS puede leer la respuesta con Modo voz.");
      voice.setMode(true);
      return;
    }
    if (!voice.consent && !window.confirm("¿Permites una conversación por voz? El navegador puede enviar audio a Apple/Google para transcribirlo. El texto se enviará a Gemini al terminar de hablar. JARVIS no guarda grabaciones. La sesión se detiene al salir o tras 6 turnos.")) return;
    voice.setMode(true);
    voice.setConsent(true);
    voice.setMuted(false);
    session.current = { active: true, turns: 0 };
    setAutomatic(true);
    setError("");
    beginTurn();
  }
  useEffect(() => { startVoiceLatest.current = startVoiceSession; });
  useEffect(() => {
    const start = () => { if (visibleRef.current && !active.current) startVoiceLatest.current(); };
    const select = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (["general","sales","meta_ads","coding","research","documents","organization","analysis","archivist"].includes(id)) setSpecialist(id);
    };
    window.addEventListener("jarvis:start-voice", start);
    window.addEventListener("jarvis:select-agent", select);
    return () => { window.removeEventListener("jarvis:start-voice", start); window.removeEventListener("jarvis:select-agent", select); };
  }, []);
  function beginTurn() {
    if (
      !session.current.active ||
      document.hidden ||
      !visibleRef.current ||
      session.current.turns >= 6
    ) {
      stopConversation();
      return;
    }
    voice.listen("", setText, (transcript) => {
      if (!session.current.active) return;
      const clean = transcript
        .replace(/^(?:oye\s+|hey\s+)?jarvis[,:.\s]*/i, "")
        .trim();
      if (!clean) {
        setError("Te escucho: pulsa el micrófono y di también tu solicitud.");
        stopConversation();
        return;
      }
      session.current.turns++;
      void sendLatest.current(clean);
    });
  }
  useEffect(() => {
    sendLatest.current = send;
    listenLatest.current = beginTurn;
  });
  useEffect(() => {
    if (voice.error || !visible || !voice.mode || !voice.consent || voice.muted) {
      session.current.active = false;
      const timer = setTimeout(() => setAutomatic(false), 0);
      return () => clearTimeout(timer);
    }
  }, [voice.error, visible, voice.mode, voice.consent, voice.muted]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) stopConversation();
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
    // Session resources are refs; do not restart subscriptions on each utterance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function reviewPrompt() {
    return `Prepara mi revisión diaria: 3 prioridades concretas, riesgos y propuestas. Usa objetivos, pendientes y recuerdos aportados; si no hay datos suficientes, pregunta por el objetivo del día en vez de inventar prioridades técnicas. No tienes acceso al repositorio ni a servicios externos: no inventes auditorías o cambios. El indicador de respuesta recibida solo prueba transporte con Gemini, NUNCA exactitud o calidad. La disponibilidad del micrófono no prueba que el usuario pueda dictar. Para cada propuesta separa evidencia aportada, supuesto y dato faltante.`;
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      setUseServerMemory(localStorage.getItem("jarvis.memory.serverConsent") === "true");
      setDailyEnabled(localStorage.getItem("jarvis.daily.enabled") === "true");
      setUseMemory(
        localStorage.getItem("jarvis.memory.allowGoogle") === "true",
      );
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!dailyEnabled || !status?.enabled || !visible || document.hidden)
      return;
    if (!navigator.locks) return;
    const timer = setTimeout(() => {
      void navigator.locks.request(
        "jarvis-daily-review",
        { ifAvailable: true },
        async (lock) => {
          if (!lock || active.current || document.hidden) return;
          const today = new Date().toISOString().slice(0, 10);
          if (localStorage.getItem("jarvis.daily.attempt") === today) return;
          localStorage.setItem("jarvis.daily.attempt", today);
          setDailyNote(
            "Revisión diaria en curso. Un intento por día al abrir, sin reintentos automáticos.",
          );
          await sendLatest.current(reviewPrompt(), "organization", true);
        },
      );
    }, 1000);
    return () => clearTimeout(timer);
    // Uses latest chat callback. Never create a timer loop or run while hidden.
  }, [dailyEnabled, status?.enabled, visible]);
  async function send(
    override?: string,
    agentOverride?: string,
    review = false,
  ) {
    const prompt = (override ?? text).trim();
    if (!prompt || active.current || wait) return;
    if (!status?.enabled) {
      session.current.active = false;
      setAutomatic(false);
      setError(
        "Gemini no está conectado. La transcripción queda disponible para corregirla o guardarla en memoria.",
      );
      return;
    }
    voice.cancelListening();
    voice.stopSpeech();
    const controller = new AbortController();
    active.current = controller;
    const deadline = setTimeout(() => controller.abort(), 28000);
    setPending(true);
    setError("");
    let context = messages.slice(-18).map(({ role, text }) => ({ role, text }));
    while (
      context.length &&
      context.reduce((n, m) => n + m.text.length, prompt.length) > 24000
    )
      context = context.slice(2);
    try {
      let memoryContext: ReturnType<typeof retrieveMemory> | null = null;
      if (useMemory) {
        const docs = await vault.load();
        memoryContext = retrieveMemory(docs, prompt);
        setMemoryReport(
          `Índice revisado: ${docs.length} archivos. Fragmentos enviados: ${memoryContext.memories.length}. No se afirma lectura íntegra de todos los archivos por Gemini.`,
        );
      }
      const response = await fetch("/api/backend/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...context, { role: "user", text: prompt }],
          ...((agentOverride || specialist) !== "auto"
            ? { agent: agentOverride || specialist }
            : {}),
          ...(useServerMemory
            ? { use_server_memory: true, project: "personal" }
            : {}),
          ...(memoryContext
            ? {
                memory_index: memoryContext.memory_index,
                memories: memoryContext.memories,
              }
            : {}),
        }),
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await response.json();
      if (active.current !== controller) return;
      if (!response.ok) {
        if (response.status === 429) {
          const delay = Math.min(
            86400,
            Math.max(1, Number(response.headers.get("Retry-After")) || 60),
          );
          setNow(Date.now());
          setRetryUntil(Date.now() + delay * 1000);
        }
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "No se pudo completar la solicitud privada.",
        );
      }
      if (
        typeof data.text !== "string" ||
        !data.text.trim() ||
        !["gemini", "memory"].includes(data.provider)
      )
        throw new Error("Respuesta de Gemini inválida.");
      setMessages((previous) =>
        [
          ...previous,
          { role: "user" as const, text: prompt },
          {
            role: "assistant" as const,
            text: data.text,
            provider: data.provider,
          },
        ].slice(-40),
      );
      setText("");
      if (review) {
        try {
          await vault.remember(
            `Revisión JARVIS ${new Date().toISOString().slice(0, 10)}`,
            data.text,
          );
          setDailyNote(
            "Revisión generada y guardada. Son propuestas: no se modificó la aplicación ni se ejecutaron acciones externas.",
          );
        } catch {
          setDailyNote(
            "Revisión recibida, pero no se pudo guardar en memoria. Puedes exportarla manualmente.",
          );
        }
      }
      if (data.memory_warning) setError(data.memory_warning);
      if (typeof data.agent === "string")
        setRouting(
          `${data.agent}: ${data.routing_reason || "Selección del orquestador"}`,
        );
      if (visibleRef.current)
        voice.speak(data.text, () => {
          if (session.current.active)
            setTimeout(() => listenLatest.current(), 300);
        });
      if (data.provider === "gemini")
        onStatus(
          (previous) =>
            previous && {
              ...previous,
              state: "configured",
              verified: true,
              detail: "Respuesta recibida de Gemini; contenido no auditado.",
            },
        );
      if (data.truncated)
        setError(
          "La respuesta alcanzó el límite de longitud. Puedes pedir que continúe.",
        );
    } catch (cause) {
      session.current.active = false;
      if (active.current !== controller) return;
      const message = controller.signal.aborted
        ? "Solicitud detenida o tiempo de espera agotado. No se reintentará sola."
        : cause instanceof Error
          ? cause.message
          : "Error de conexión";
      setError(message);
      if (!controller.signal.aborted)
        onStatus(
          (previous) =>
            previous && { ...previous, state: "error", detail: message },
        );
    } finally {
      clearTimeout(deadline);
      if (active.current === controller) {
        active.current = null;
        setPending(false);
      }
    }
  }
  return (
    <section
      className="gemini-conversation"
      aria-label="Chat privado con Gemini"
    >
      <div className="jarvis-talk-bar">
        <button type="button" className="private-button jarvis-talk" disabled={pending && !automatic} aria-pressed={automatic} onClick={startVoiceSession}>
          {automatic ? <Square size={22} /> : <Mic size={22} />} {automatic ? "Detener conversación" : "Hablar con JARVIS"}
        </button>
        <p className="voice-help" role="note">{automatic ? "Escucha → Gemini → respuesta hablada. Sesión de hasta 6 turnos." : "Un toque para conversar. También puedes tocar el ojo. Sin escucha en segundo plano."}</p>
        {lastReply && voice.mode && !voice.speaking && <button type="button" className="jarvis-text-link" onClick={() => voice.speak(lastReply)}>Escuchar última respuesta</button>}
      </div>
      <details className="personal-memory">
        <summary>Misiones y revisión diaria</summary>
        <p className="voice-help">
          Genera prioridades y propuestas con Gemini y guarda un archivo de
          revisión. No modifica código, anuncios ni cuentas. Para trabajar con
          el iPad cerrado hace falta una infraestructura que aún no está
          configurada.
        </p>
        <button
          type="button"
          className="private-button secondary"
          disabled={!status?.enabled || pending}
          onClick={() =>
            void sendLatest.current(reviewPrompt(), "organization", true)
          }
        >
          Ejecutar revisión de hoy
        </button>
        <label className="voice-consent">
          <input
            type="checkbox"
            checked={dailyEnabled}
            onChange={(event) => {
              setDailyEnabled(event.target.checked);
              localStorage.setItem(
                "jarvis.daily.enabled",
                String(event.target.checked),
              );
            }}
          />{" "}
          Autorizar una revisión gratuita al día cuando abra JARVIS (consume
          cuota Gemini)
        </label>
        <p className="voice-help">
          {dailyNote} Si el navegador no permite coordinación entre pestañas,
          usa el botón manual.
        </p>
      </details>
      <label className="voice-consent">
        <input
          type="checkbox"
          checked={useServerMemory}
          onChange={(e) => { setUseServerMemory(e.target.checked); localStorage.setItem("jarvis.memory.serverConsent", String(e.target.checked)); }}
        />{" "}
        Consultar memoria del servidor (solo si está configurada y autorizada)
      </label>
      <details><summary>Archivo cifrado de este navegador (opcional)</summary>
      <PersonalMemory
        vault={vault}
        draft={
          text || messages.filter((m) => m.role === "user").at(-1)?.text || ""
        }
        useMemory={useMemory}
        onUse={(value) => {
          setUseMemory(value);
          localStorage.setItem("jarvis.memory.allowGoogle", String(value));
        }}
      />
      </details>
      <label className="specialist-select">
        Especialista
        <select
          aria-label="Especialista"
          value={specialist}
          onChange={(event) => setSpecialist(event.target.value)}
        >
          {[
            ["auto", "Automático"],
            ["general", "Asistente personal"],
            ["sales", "Ventas"],
            ["meta_ads", "Meta Ads"],
            ["coding", "Programación"],
            ["research", "Investigación"],
            ["documents", "Documentos"],
            ["organization", "Organización"],
            ["analysis", "Análisis"],
            ["archivist", "Archivista"],
          ].map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {routing && <p className="voice-help">{routing}</p>}
      {memoryReport && <p className="voice-help">{memoryReport}</p>}
      <details className="voice-settings"><summary>Ajustes de voz y dictado</summary>
        <label className="voice-switch">
          <input
            type="checkbox"
            role="switch"
            aria-label="Modo voz"
            checked={voice.mode}
            onChange={(event) => voice.setMode(event.target.checked)}
          />{" "}
          Modo voz
        </label>
        {voice.mode && (
          <>
            <p className="voice-help">
              El reconocimiento puede enviar audio al servicio del navegador
              (Apple/Google). JARVIS no graba ni guarda audio. Solo escucha al
              pulsar el micrófono.
            </p>
            <label className="voice-consent">
              <input
                type="checkbox"
                checked={voice.consent}
                onChange={(event) => voice.setConsent(event.target.checked)}
              />{" "}
              Acepto usar el reconocimiento de voz del navegador
            </label>
            <div className="voice-controls">
              <label>
                Voz en español
                <select
                  aria-label="Voz en español"
                  value={voice.voiceURI}
                  onChange={(event) => voice.selectVoice(event.target.value)}
                >
                  <option value="auto">Automática · español</option>
                  {voice.voices.map((item) => (
                    <option key={item.voiceURI} value={item.voiceURI}>
                      {item.name} · {item.lang}
                      {item.localService
                        ? " · dispositivo"
                        : " · servicio del navegador"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="private-button secondary"
                disabled={!voice.speechSupported}
                aria-pressed={voice.muted}
                onClick={() => voice.setMuted(!voice.muted)}
              >
                {voice.muted ? <VolumeX size={17} /> : <Volume2 size={17} />}{" "}
                {voice.muted ? "Activar sonido" : "Silenciar"}
              </button>
              <button
                type="button"
                className="private-button secondary"
                disabled={
                  !lastReply || !voice.speechSupported || voice.muted || pending
                }
                onClick={() => voice.speak(lastReply)}
              >
                <Play size={17} /> Reproducir respuesta
              </button>
              <button
                type="button"
                className="private-button secondary"
                disabled={!voice.speaking}
                onClick={voice.stopSpeech}
              >
                <Square size={17} /> Detener voz
              </button>
            </div>
            <div className="voice-session">
              <button
                type="button"
                className="private-button secondary"
                disabled={
                  !status?.enabled ||
                  !voice.consent ||
                  !voice.supported ||
                  !voice.speechSupported ||
                  pending
                }
                onClick={() => {
                  voice.setMode(true);
                  session.current = { active: true, turns: 0 };
                  setAutomatic(true);
                  setError("");
                  beginTurn();
                }}
              >
                Iniciar conversación automática
              </button>
              <button
                type="button"
                className="private-button secondary"
                disabled={!automatic}
                onClick={() => {
                  stopConversation();
                  active.current?.abort();
                }}
              >
                Finalizar sesión desde ajustes
              </button>
              <p className="voice-help">
                {automatic
                  ? "Sesión automática activada: se envía al terminar de hablar y vuelve a escuchar tras la respuesta. Máximo 6 turnos; se detiene al salir o con un error."
                  : "Sin escucha permanente. Inicia una sesión con un toque; fuera de ella revisas y envías cada mensaje. Safari puede requerir otro toque para seguir escuchando."}
              </p>
            </div>
            {!voice.supported && (
              <p className="voice-help">
                Este navegador no ofrece reconocimiento directo. Toca el mensaje
                y luego el micrófono del teclado del iPad. Si falta, revisa
                Ajustes → General → Teclado → Activar dictado.
              </p>
            )}
            {!voice.speechSupported && (
              <p className="voice-help">
                Síntesis no disponible en este navegador. Las respuestas siguen
                disponibles por escrito.
              </p>
            )}
            <button
              type="button"
              className="jarvis-text-link voice-keyboard"
              disabled={pending || voice.listening || voice.starting}
              onClick={() => input.current?.focus()}
            >
              <Keyboard size={17} /> Usar dictado del teclado
            </button>
            <button type="button" className="jarvis-text-link" disabled={pending || automatic || !voice.consent || !voice.supported}
              aria-label={voice.listening || voice.starting ? "Finalizar dictado" : "Iniciar dictado"}
              onClick={() => voice.listening || voice.starting ? voice.finishListening() : voice.listen(text, setText)}>
              Dictar borrador sin enviar
            </button>
            <p className="voice-help">
              Revisa y corrige la transcripción en el mensaje antes de pulsar
              Enviar. Solo se envía automáticamente dentro de una sesión
              iniciada por ti.
            </p>
          </>
        )}
      </details>
      {automatic && <div className="jarvis-voice-stage" role="status" aria-live="polite">
        <strong>{voice.listening ? "Te escucho…" : voice.starting ? "Abriendo micrófono…" : pending ? "JARVIS está pensando…" : voice.speaking ? "JARVIS está hablando…" : "Preparando el siguiente turno…"}</strong>
        <p>Al hacer una pausa se envía tu frase, sin pulsar Enviar. Para salir, pulsa Detener conversación.</p>
        {text && <p>He oído: {text}</p>}
      </div>}
      {(voice.listening || voice.starting) && (
        <p className="voice-listening" role="status">
          {voice.starting ? "Solicitando micrófono…" : "Escuchando en español…"}{" "}
          {automatic ? "Haz una pausa cuando termines; enviaré tu frase automáticamente." : "Pulsa Finalizar dictado para revisar el texto."}
        </p>
      )}
      {voice.error && (
        <p className="gemini-error" role="alert">
          {voice.error}
        </p>
      )}
      {messages.length > 0 && (
        <div
          ref={list}
          className="gemini-messages"
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.map((message, i) => (
            <article
              key={i}
              className={`gemini-message gemini-${message.role}`}
            >
              <strong>
                {message.role === "user"
                  ? "Tú"
                  : message.provider === "memory"
                    ? "Memoria · confirmación del servidor"
                    : "JARVIS · Gemini"}
              </strong>
              <p>{message.text}</p>
            </article>
          ))}
        </div>
      )}
      <form
        className="jarvis-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="sr-only" htmlFor="jarvis-chat-message">
          Mensaje a JARVIS
        </label>
        <textarea
          id="jarvis-chat-message"
          rows={2}
          maxLength={6000}
          value={text}
          onChange={(event) => setText(event.target.value)}
          ref={input}
          disabled={pending || voice.listening || voice.starting}
          placeholder={
            status?.enabled
              ? "Escribe tu mensaje para Gemini…"
              : "Puedes dictar y guardar memoria; Gemini espera conexión"
          }
        />
        <button
          type="button"
          disabled={
            pending && !automatic
          }
          aria-label={automatic ? "Detener conversación desde el micrófono" : "Conversar por voz"}
          aria-pressed={automatic}
          onClick={startVoiceSession}
        >
          <Mic size={20} />
        </button>
        {pending ? (
          <button
            type="button"
            className="jarvis-send"
            aria-label="Detener solicitud"
            onClick={() => {
              active.current?.abort();
              voice.stopAll();
            }}
          >
            <Square size={19} />
          </button>
        ) : (
          <button
            type="submit"
            className="jarvis-send"
            disabled={
              !status?.enabled ||
              !text.trim() ||
              wait > 0 ||
              voice.listening ||
              voice.starting
            }
            aria-label="Enviar mensaje a Gemini"
          >
            <Send size={19} />
          </button>
        )}
      </form>
      {pending && (
        <p className="gemini-processing" role="status">
          <LoaderCircle size={16} className="jarvis-spin" /> Esperando respuesta
          real de Gemini…
        </p>
      )}
      {error && (
        <p className="gemini-error" role="alert">
          {error}
          {wait > 0 && ` Reintento manual disponible en ${wait} s.`}
        </p>
      )}
      <div className="jarvis-chat-footer">
        <span>{status?.detail || "Estado de Gemini sin verificar"}</span>
        <span>Acceso privado · sin respuestas simuladas</span>
      </div>
      <p className="gemini-privacy">
        Solo al enviar se comparte con Google el mensaje y contexto reciente.
        Conversación en memoria de esta pestaña; no se guarda al recargar.
        Detener cancela la espera; Google puede haber recibido la solicitud.
      </p>
      {messages.length > 0 && (
        <button
          className="jarvis-text-link"
          disabled={pending}
          onClick={() => {
            setMessages([]);
            setError("");
            voice.stopAll();
          }}
        >
          Nueva conversación
        </button>
      )}
    </section>
  );
}
