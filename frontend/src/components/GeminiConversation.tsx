"use client";
// Reuse React and installed icons; all Gemini traffic goes through the owner-only BFF.
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { LoaderCircle, MicOff, Send, Square } from "lucide-react";
export type GeminiStatus = {
  state: "configured" | "not_configured" | "error";
  enabled: boolean; verified: boolean; detail: string; model: string;
};
type Message = { role: "user" | "assistant"; text: string };
interface Props { status: GeminiStatus | null; onStatus: Dispatch<SetStateAction<GeminiStatus | null>> }
export default function GeminiConversation({ status, onStatus }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retryUntil, setRetryUntil] = useState(0);
  const [now, setNow] = useState(0);
  const active = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => () => { active.current?.abort(); active.current = null; }, []);
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight; }, [messages.length, pending]);
  useEffect(() => {
    if (!retryUntil) return;
    const interval = setInterval(() => { const time = Date.now(); setNow(time); if (time >= retryUntil) clearInterval(interval); }, 1000);
    return () => clearInterval(interval);
  }, [retryUntil]);
  const wait = Math.max(0, Math.ceil((retryUntil - now) / 1000));
  async function send() {
    const prompt = text.trim();
    if (!prompt || !status?.enabled || active.current || wait) return;
    const controller = new AbortController(); active.current = controller;
    const deadline = setTimeout(() => controller.abort(), 28000);
    setPending(true); setError("");
    let context = messages.slice(-18);
    while (context.length && context.reduce((n, m) => n + m.text.length, prompt.length) > 24000) context = context.slice(2);
    try {
      const response = await fetch("/api/backend/chat", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...context, { role: "user", text: prompt }] }), signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (active.current !== controller) return;
      if (!response.ok) {
        if (response.status === 429) {
          const delay = Math.min(86400, Math.max(1, Number(response.headers.get("Retry-After")) || 60));
          setNow(Date.now()); setRetryUntil(Date.now() + delay * 1000);
        }
        throw new Error(typeof data.error === "string" ? data.error : "No se pudo completar la solicitud privada.");
      }
      if (typeof data.text !== "string" || !data.text.trim() || data.provider !== "gemini") throw new Error("Respuesta de Gemini inválida.");
      setMessages(previous => [...previous, { role: "user" as const, text: prompt }, { role: "assistant" as const, text: data.text }].slice(-40));
      setText("");
      onStatus(previous => previous && { ...previous, state: "configured", verified: true, detail: "Respuesta real verificada." });
      if (data.truncated) setError("La respuesta alcanzó el límite de longitud. Puedes pedir que continúe.");
    } catch (cause) {
      if (active.current !== controller) return;
      const message = controller.signal.aborted ? "Solicitud detenida o tiempo de espera agotado. No se reintentará sola." : cause instanceof Error ? cause.message : "Error de conexión";
      setError(message);
      if (!controller.signal.aborted) onStatus(previous => previous && { ...previous, state: "error", detail: message });
    } finally {
      clearTimeout(deadline);
      if (active.current === controller) { active.current = null; setPending(false); }
    }
  }
  return <section className="gemini-conversation" aria-label="Chat privado con Gemini">
    {messages.length > 0 && <div ref={list} className="gemini-messages" aria-live="polite" aria-relevant="additions">{messages.map((message, i) => <article key={i} className={`gemini-message gemini-${message.role}`}><strong>{message.role === "user" ? "Tú" : "Gemini"}</strong><p>{message.text}</p></article>)}</div>}
    <form className="jarvis-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
      <label className="sr-only" htmlFor="jarvis-chat-message">Mensaje a JARVIS</label>
      <textarea id="jarvis-chat-message" rows={2} maxLength={6000} value={text} onChange={event => setText(event.target.value)} disabled={!status?.enabled || pending} placeholder={status?.enabled ? "Escribe tu mensaje para Gemini…" : "Chat disponible tras configurar y autorizar Gemini"}/>
      <button type="button" disabled aria-label="Voz no configurada" title="Voz no configurada"><MicOff size={20}/></button>
      {pending ? <button type="button" className="jarvis-send" aria-label="Detener solicitud" onClick={() => active.current?.abort()}><Square size={19}/></button> : <button type="submit" className="jarvis-send" disabled={!status?.enabled || !text.trim() || wait > 0} aria-label="Enviar mensaje a Gemini"><Send size={19}/></button>}
    </form>
    {pending && <p className="gemini-processing" role="status"><LoaderCircle size={16} className="jarvis-spin"/> Esperando respuesta real de Gemini…</p>}
    {error && <p className="gemini-error" role="alert">{error}{wait > 0 && ` Reintento manual disponible en ${wait} s.`}</p>}
    <div className="jarvis-chat-footer"><span>{status?.detail || "Estado de Gemini sin verificar"}</span><span>Acceso privado · sin respuestas simuladas</span></div>
    <p className="gemini-privacy">Solo al enviar se comparte con Google el mensaje y contexto reciente. Conversación en memoria de esta pestaña; no se guarda al recargar. Detener cancela la espera; Google puede haber recibido la solicitud.</p>
    {messages.length > 0 && <button className="jarvis-text-link" disabled={pending} onClick={() => { setMessages([]); setError(""); }}>Nueva conversación</button>}
  </section>;
}
