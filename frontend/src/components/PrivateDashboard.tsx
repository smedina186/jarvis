"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, Bot, CircleAlert, Code2, FileText,
  Layers3, Link2, ListTodo, LockKeyhole, MessageCircle, Plus,
  Radar, RefreshCw, Search, ShieldCheck, Workflow,
} from "lucide-react";
import Image from "next/image";
import ServerMemory from "./ServerMemory";
import ServerMissions from "./ServerMissions";
import GeminiConversation, { type GeminiStatus } from "./GeminiConversation";
import type { VoiceActivity } from "@/hooks/useBrowserVoice";

type Section = "chat" | "agentes" | "misiones" | "conexiones" | "memoria";
type BackendHealth = "checking" | "connected" | "error";

const navItems = [
  { key: "chat", label: "Chat", Icon: MessageCircle },
  { key: "agentes", label: "Agentes", Icon: Layers3 },
  { key: "misiones", label: "Misiones", Icon: Radar },
  { key: "memoria", label: "Memoria", Icon: FileText },
  { key: "conexiones", label: "Conexiones", Icon: Link2 },
] as const;

const agentProfiles = [
  { id: "sales", label: "Ventas", Icon: Search },
  { id: "meta_ads", label: "Meta Ads", Icon: Activity },
  { id: "research", label: "Investigación", Icon: Search },
  { id: "coding", label: "Programación", Icon: Code2 },
  { id: "documents", label: "Documentos", Icon: FileText },
  { id: "organization", label: "Organización", Icon: ListTodo },
  { id: "analysis", label: "Análisis", Icon: Activity },
  { id: "archivist", label: "Archivista", Icon: FileText },
  { id: "automation", label: "Automatizaciones", Icon: Workflow },
] as const;

function JarvisEye({ activity, beat }: { activity: VoiceActivity; beat: boolean }) {
  return (
    <div className={`jarvis-eye-scene jarvis-eye-${activity} ${beat ? "jarvis-eye-beat" : ""}`} data-activity={activity} aria-label="Núcleo visual de JARVIS" role="img">
      <span className="jarvis-circuit jarvis-circuit-left" aria-hidden="true" />
      <span className="jarvis-circuit jarvis-circuit-right" aria-hidden="true" />
      <div className="jarvis-eye-halo" aria-hidden="true">
        <div className="jarvis-eye-ring jarvis-eye-ring-one" />
        <div className="jarvis-eye-ring jarvis-eye-ring-two" />
        <div className="jarvis-eye-ring jarvis-eye-ring-three" />
        <div className="jarvis-eye-disc">
          <div className="jarvis-eye-hexagon"><span className="jarvis-eye-gem" /></div>
        </div>
      </div>
    </div>
  );
}

type Connection = {
  label: string;
  state: "connected" | "error" | "checking" | "unknown" | "missing" | "configured";
  detail: string;
};

function ConnectionRow({ connection }: { connection: Connection }) {
  const stateLabel = {
    connected: "Conectado", error: "Error", checking: "Comprobando",
    unknown: "Sin verificar", missing: "Sin configurar", configured: "Configurado",
  }[connection.state];

  return (
    <li className="jarvis-connection-row">
      <span className={`jarvis-signal jarvis-signal-${connection.state}`} aria-hidden="true" />
      <span className="jarvis-connection-label">{connection.label}<small>{connection.detail}</small></span>
      <span className={`jarvis-state jarvis-state-${connection.state}`}>{stateLabel}</span>
    </li>
  );
}

export default function PrivateDashboard() {
  const router = useRouter();
  // Keep navigation current without making the health effect depend on router identity.
  // RESEARCH/DECISION: use existing React refs and AbortController; no polling dependency.
  const routerRef = useRef(router);
  const healthRequest = useRef<AbortController | null>(null);
  useEffect(() => { routerRef.current = router; }, [router]);
  const [voiceActivity, setVoiceActivity] = useState<VoiceActivity>("idle");
  const [voiceBeat, setVoiceBeat] = useState(false);
  const [gemini, setGemini] = useState<GeminiStatus | null>(null);
  const [memoryState, setMemoryState] = useState("unknown");
  const [frontendHost, setFrontendHost] = useState("");
  const [healthError, setHealthError] = useState("");
  const [section, setSection] = useState<Section>("chat");
  const [health, setHealth] = useState<BackendHealth>("checking");
  const [pending, setPending] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const check = useCallback(async () => {
    if (healthRequest.current) return;
    const controller = new AbortController();
    healthRequest.current = controller;
    const deadline = setTimeout(() => controller.abort(), 65000);
    setFrontendHost(window.location.hostname);
    setHealthError("");
    setPending(true);
    setHealth("checking");
    const startedAt = performance.now();
    try {
      // This is the existing owner-protected proxy. Never call Render with browser secrets.
      const response = await fetch("/api/backend/health", {
        cache: "no-store", signal: controller.signal,
      });
      if (healthRequest.current !== controller) return;
      if (response.status === 401) { routerRef.current.replace("/login"); return; }
      const data: unknown = await response.json();
      if (healthRequest.current !== controller) return;
      const verified = response.ok && typeof data === "object" && data !== null &&
        "status" in data && data.status === "ok";
      setHealth(verified ? "connected" : "error");
      if (!verified) setHealthError(typeof data === "object" && data !== null &&
        "error" in data && typeof data.error === "string" ? data.error : "No se pudo verificar el backend privado.");
      setLatency(verified ? Math.round(performance.now() - startedAt) : null);
      if (verified) {
        try {
        const providerResponse = await fetch("/api/backend/gemini/status", { cache: "no-store", signal: controller.signal });
        const provider = await providerResponse.json();
        if (healthRequest.current !== controller) return;
        if (providerResponse.ok && ["configured", "not_configured", "error"].includes(provider.state)) setGemini((previous) => ({ ...provider, verified: provider.verified || previous?.verified || false }));
        else setGemini(null);
        } catch { if (healthRequest.current === controller) setGemini(null); }
        try {
          const memoryResponse = await fetch("/api/backend/memory/status", { cache: "no-store", signal: controller.signal });
          const memory = await memoryResponse.json();
          if (healthRequest.current === controller) setMemoryState(memoryResponse.ok && memory.state === "active" ? "connected" : memory.state === "pending" ? "missing" : "error");
        } catch { if (healthRequest.current === controller) setMemoryState("error"); }
      } else { setGemini(null); setMemoryState("unknown"); }
    } catch {
      if (healthRequest.current !== controller) return;
      setHealthError(controller.signal.aborted
        ? "La comprobación tardó más de 65 segundos. Espera un minuto y vuelve a intentarlo manualmente."
        : "No se pudo contactar con Render. Vuelve a intentarlo manualmente.");
      setHealth("error");
      setGemini(null);
      setLatency(null);
    } finally {
      clearTimeout(deadline);
      if (healthRequest.current !== controller) return;
      healthRequest.current = null;
      setCheckedAt(new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }));
      setPending(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => { void check(); }, 0);
    return () => {
      clearTimeout(initial);
      healthRequest.current?.abort();
      healthRequest.current = null;
    };
  }, [check]);

  const connections: Connection[] = [
    { label: "GitHub OAuth", state: "connected", detail: "Sesión del propietario verificada" },
    { label: "Netlify · interfaz", state: frontendHost === "jarvismedina.netlify.app" ? "connected" : "unknown", detail: frontendHost === "jarvismedina.netlify.app" ? "Esta página respondió desde Netlify; no verifica facturación" : "No se verificó el alojamiento de esta página" },
    { label: "Render", state: health === "connected" ? "connected" : health === "checking" ? "checking" : "error",
      detail: health === "connected" ? `Verificado${checkedAt ? ` · ${checkedAt}` : ""}${latency !== null ? ` · ${latency} ms` : ""}` :
        health === "error" ? `No responde a salud privada${checkedAt ? ` · ${checkedAt}` : ""}` : "Comprobando ruta privada…" },
    { label: "Gemini", state: gemini?.state === "configured" ? (gemini.verified ? "connected" : "configured") : gemini?.state === "not_configured" ? "missing" : gemini?.state === "error" ? "error" : "unknown", detail: gemini?.verified && gemini.state === "configured" ? "Respuesta recibida; contenido no auditado" : gemini?.detail || "Estado pendiente de verificar con Render" },
    { label: "Neon · memoria", state: memoryState as Connection["state"], detail: memoryState === "connected" ? "Consulta autenticada al almacenamiento confirmada" : "Almacenamiento pendiente de comprobar" },
    { label: "OpenAI / ChatGPT", state: "missing", detail: "Sin API gratuita autorizada; la suscripción personal no la activa" },
  ];

  return (
    <div className="jarvis-dashboard">
      <nav className="jarvis-nav" aria-label="Secciones de JARVIS">
        {navItems.map(({ key, label, Icon }) => (
          <button key={key} type="button" className={`jarvis-nav-item ${section === key ? "active" : ""}`}
            aria-current={section === key ? "page" : undefined} onClick={() => setSection(key)}>
            <Icon size={19} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span>
          </button>
        ))}
        <div className="jarvis-nav-note"><LockKeyhole size={15} aria-hidden="true" /> Solo acceso autorizado</div>
      </nav>

      <div className="jarvis-main-panel">
          <section className="jarvis-chat" hidden={section !== "chat"} aria-label="Panel principal">
            <button type="button" className="jarvis-eye-button" aria-label="Hablar con JARVIS desde el ojo" onClick={() => window.dispatchEvent(new Event("jarvis:start-voice"))}><JarvisEye activity={voiceActivity} beat={voiceBeat} /></button>
            <h2 className="jarvis-greeting">Bienvenido, Sebastián. ¿En qué trabajamos hoy?</h2>
            <GeminiConversation status={gemini} onStatus={setGemini} onActivity={setVoiceActivity} onBeat={setVoiceBeat} visible={section === "chat"} />
          </section>

        {section === "agentes" && (
          <section className="jarvis-detail" aria-labelledby="agents-title">
            <div className="jarvis-detail-heading"><Bot size={25} aria-hidden="true" /><div><p className="private-eyebrow">CAPACIDADES</p><h2 id="agents-title">Agentes</h2></div></div>
            <div className="jarvis-empty-state"><CircleAlert size={19} aria-hidden="true" /> Perfiles especializados para Gemini. No ejecutan acciones externas.</div>
            <ul className="jarvis-agent-grid">
              {agentProfiles.map(({ id, label, Icon }) => <li key={label}><Icon size={20} aria-hidden="true" /><span>{label}</span><small>{id === "automation" ? "Ejecución externa desactivada" : gemini?.enabled ? "Especialista de Gemini; herramientas externas no habilitadas" : "Pendiente de Gemini"}</small><button type="button" className="jarvis-text-link" disabled={id === "automation"} onClick={() => { setSection("chat"); window.dispatchEvent(new CustomEvent("jarvis:select-agent", { detail: id })); }}>Conversar con {label}</button></li>)}
            </ul>
          </section>
        )}

        {section === "misiones" && <ServerMissions geminiEnabled={Boolean(gemini?.enabled)} />}
        {section === "memoria" && <ServerMemory />}

        {section === "conexiones" && (
          <section className="jarvis-detail" aria-labelledby="connections-title">
            <div className="jarvis-detail-heading"><Link2 size={25} aria-hidden="true" /><div><p className="private-eyebrow">DIAGNÓSTICO</p><h2 id="connections-title">Conexiones</h2></div></div>
            <p className="jarvis-muted">Los indicadores muestran únicamente estados verificables. No se realizan llamadas a modelos.</p>
            <ul className="jarvis-connection-list jarvis-detail-connections">{connections.map(item => <ConnectionRow key={item.label} connection={item} />)}</ul>
            {healthError && <p className="jarvis-muted" role="alert">{healthError}</p>}
            <button type="button" className="private-button secondary jarvis-check" onClick={() => { void check(); }} disabled={pending}>
              <RefreshCw size={16} className={pending ? "jarvis-spin" : ""} aria-hidden="true" /> {pending ? "Comprobando…" : "Comprobar Render"}
            </button>
          </section>
        )}
      </div>

      <aside className="jarvis-sidebar" aria-label="Estado de JARVIS">
        <div className="jarvis-side-card">
          <div className="jarvis-side-heading"><h2><ShieldCheck size={17} aria-hidden="true" /> Estado del sistema</h2><span className="jarvis-label-live">REAL</span></div>
          <ul className="jarvis-connection-list">{connections.map(item => <ConnectionRow key={item.label} connection={item} />)}</ul>
          <div className="jarvis-health-footer">
            {healthError && <p role="alert">{healthError}</p>}
            {pending && <button type="button" className="jarvis-text-link" onClick={() => healthRequest.current?.abort()}>Cancelar comprobación</button>}
            <p role="status" aria-live="polite">{health === "connected" ? "Backend privado conectado" : health === "checking" ? "Despertando y comprobando Render Free (máximo 65 s)…" : "Backend privado sin conexión"}</p>
            <button type="button" className="private-button secondary jarvis-check" onClick={() => { void check(); }} disabled={pending}>
              <RefreshCw size={15} className={pending ? "jarvis-spin" : ""} aria-hidden="true" /> {pending ? "Comprobando…" : "Comprobar conexión"}
            </button>
          </div>
        </div>
        <div className="jarvis-side-card jarvis-next-card">
          <h2><ListTodo size={17} aria-hidden="true" /> Misiones</h2>
          <p>No hay ejecutor continuo. Consulta planes y checkpoints en Misiones.</p>
          <button className="jarvis-text-link" type="button" onClick={() => setSection("misiones")}>Ver misiones <Plus size={15} aria-hidden="true" /></button>
        </div>
        <div className="jarvis-watermark" aria-label="Emblema personal: perro con ojo azul y 186">
          <Image src="/jarvis-dog-186.webp" alt="Perro de Sebastián con ojo azul, emblema 186" width={220} height={192} priority={false} />
        </div>
      </aside>
    </div>
  );
}
