"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity, Bot, CircleAlert, Clock3, Code2, FileText,
  Layers3, Link2, ListTodo, LockKeyhole, MessageCircle, MicOff, Plus,
  Radar, RefreshCw, Search, Send, ShieldCheck, Sparkles, Workflow,
} from "lucide-react";
import Image from "next/image";

type Section = "chat" | "agentes" | "misiones" | "conexiones";
type BackendHealth = "checking" | "connected" | "error";

const navItems = [
  { key: "chat", label: "Chat", Icon: MessageCircle },
  { key: "agentes", label: "Agentes", Icon: Layers3 },
  { key: "misiones", label: "Misiones", Icon: Radar },
  { key: "conexiones", label: "Conexiones", Icon: Link2 },
] as const;

const agentProfiles = [
  { label: "Investigación", Icon: Search },
  { label: "Programación", Icon: Code2 },
  { label: "Documentos", Icon: FileText },
  { label: "Organización", Icon: ListTodo },
  { label: "Análisis", Icon: Activity },
  { label: "Automatizaciones", Icon: Workflow },
] as const;

function JarvisEye() {
  return (
    <div className="jarvis-eye-scene" aria-label="Núcleo visual de JARVIS" role="img">
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
  state: "connected" | "error" | "checking" | "unknown" | "missing";
  detail: string;
};

function ConnectionRow({ connection }: { connection: Connection }) {
  const stateLabel = {
    connected: "Conectado", error: "Error", checking: "Comprobando",
    unknown: "Sin verificar", missing: "Sin configurar",
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
  const [section, setSection] = useState<Section>("chat");
  const [health, setHealth] = useState<BackendHealth>("checking");
  const [pending, setPending] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const check = useCallback(async () => {
    setPending(true);
    setHealth("checking");
    const startedAt = performance.now();
    try {
      // This is the existing owner-protected proxy. Never call Render with browser secrets.
      const response = await fetch("/api/backend/health", {
        cache: "no-store", signal: AbortSignal.timeout(12000),
      });
      if (response.status === 401) { router.replace("/login"); return; }
      const data: unknown = await response.json();
      const verified = response.ok && typeof data === "object" && data !== null &&
        "status" in data && data.status === "ok";
      setHealth(verified ? "connected" : "error");
      setLatency(verified ? Math.round(performance.now() - startedAt) : null);
    } catch {
      setHealth("error");
      setLatency(null);
    } finally {
      setCheckedAt(new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }));
      setPending(false);
    }
  }, [router]);

  useEffect(() => {
    const initial = setTimeout(() => { void check(); }, 0);
    return () => clearTimeout(initial);
  }, [check]);

  const connections: Connection[] = [
    { label: "GitHub OAuth", state: "connected", detail: "Sesión del propietario verificada" },
    { label: "Netlify", state: "unknown", detail: "Comprobación externa pendiente" },
    { label: "Render", state: health === "connected" ? "connected" : health === "checking" ? "checking" : "error",
      detail: health === "connected" ? `Verificado${checkedAt ? ` · ${checkedAt}` : ""}${latency !== null ? ` · ${latency} ms` : ""}` :
        health === "error" ? `No responde a salud privada${checkedAt ? ` · ${checkedAt}` : ""}` : "Comprobando ruta privada…" },
    { label: "Gemini", state: "missing", detail: "Integración de IA pendiente" },
    { label: "OpenAI / ChatGPT", state: "missing", detail: "Integración de IA pendiente" },
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
        {section === "chat" && (
          <section className="jarvis-chat" aria-label="Panel principal">
            <JarvisEye />
            <h2 className="jarvis-greeting">Bienvenido, Sebastián. ¿En qué trabajamos hoy?</h2>
            <div className="jarvis-composer" aria-label="Chat pendiente de integración">
              <label className="sr-only" htmlFor="jarvis-chat-message">Mensaje a JARVIS</label>
              <input id="jarvis-chat-message" type="text" disabled placeholder="Chat disponible al conectar una IA" />
              <button type="button" disabled aria-label="Voz no configurada" title="Voz no configurada"><MicOff size={20} /></button>
              <button type="button" disabled className="jarvis-send" aria-label="Envío pendiente de configuración"><Send size={19} /></button>
            </div>
            <div className="jarvis-chat-footer"><span><Sparkles size={14} /> IA sin configurar</span><span>Acceso privado</span></div>
          </section>
        )}

        {section === "agentes" && (
          <section className="jarvis-detail" aria-labelledby="agents-title">
            <div className="jarvis-detail-heading"><Bot size={25} aria-hidden="true" /><div><p className="private-eyebrow">CAPACIDADES</p><h2 id="agents-title">Agentes</h2></div></div>
            <div className="jarvis-empty-state"><CircleAlert size={19} aria-hidden="true" /> Aún no hay agentes conectados. No se ejecutarán tareas.</div>
            <ul className="jarvis-agent-grid">
              {agentProfiles.map(({ label, Icon }) => <li key={label}><Icon size={20} aria-hidden="true" /><span>{label}</span><small>Inactivo</small></li>)}
            </ul>
          </section>
        )}

        {section === "misiones" && (
          <section className="jarvis-detail" aria-labelledby="missions-title">
            <div className="jarvis-detail-heading"><Radar size={25} aria-hidden="true" /><div><p className="private-eyebrow">PROYECTOS</p><h2 id="missions-title">Misiones</h2></div></div>
            <div className="jarvis-empty-state jarvis-mission-empty">
              <Clock3 size={31} aria-hidden="true" />
              <h3>No hay misiones activas</h3>
              <p>La ejecución persistente y las aprobaciones se implementarán en una fase posterior.</p>
            </div>
          </section>
        )}

        {section === "conexiones" && (
          <section className="jarvis-detail" aria-labelledby="connections-title">
            <div className="jarvis-detail-heading"><Link2 size={25} aria-hidden="true" /><div><p className="private-eyebrow">DIAGNÓSTICO</p><h2 id="connections-title">Conexiones</h2></div></div>
            <p className="jarvis-muted">Los indicadores muestran únicamente estados verificables. No se realizan llamadas a modelos.</p>
            <ul className="jarvis-connection-list jarvis-detail-connections">{connections.map(item => <ConnectionRow key={item.label} connection={item} />)}</ul>
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
            <p role="status" aria-live="polite">{health === "connected" ? "Backend privado conectado" : health === "checking" ? "Comprobando conexión privada…" : "Backend privado sin conexión"}</p>
            <button type="button" className="private-button secondary jarvis-check" onClick={() => { void check(); }} disabled={pending}>
              <RefreshCw size={15} className={pending ? "jarvis-spin" : ""} aria-hidden="true" /> {pending ? "Comprobando…" : "Comprobar conexión"}
            </button>
          </div>
        </div>
        <div className="jarvis-side-card jarvis-next-card">
          <h2><ListTodo size={17} aria-hidden="true" /> Misiones</h2>
          <p>Sin misiones en ejecución.</p>
          <button className="jarvis-text-link" type="button" onClick={() => setSection("misiones")}>Ver misiones <Plus size={15} aria-hidden="true" /></button>
        </div>
        <div className="jarvis-watermark" aria-label="Emblema personal: perro con ojo azul y 186">
          <Image src="/jarvis-dog-186.webp" alt="Perro de Sebastián con ojo azul, emblema 186" width={220} height={192} priority={false} />
        </div>
      </aside>
    </div>
  );
}
