"use client";
import { useRef, useState } from "react";
type Mission = {
  id: string;
  goal: string;
  state: string;
  approval: { actor: string; at: string } | null;
  checkpoints: unknown[];
};
export default function ServerMissions({ geminiEnabled = false }: { geminiEnabled?: boolean }) {
  const [suggestions, setSuggestions] = useState("");
  const [shareMemory, setShareMemory] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [goal, setGoal] = useState("");
  const [project, setProject] = useState("personal");
  const [message, setMessage] = useState(
    "Sin verificar: las misiones necesitan almacenamiento duradero autorizado.",
  );
  const [pending, setPending] = useState(false);
  async function action(action: string, id = "") {
    if (pending) return;
    setPending(true);
    try {
      const r = await fetch("/api/backend/missions/operate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, project, goal, agent: "archivist" }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Misiones no disponibles");
      if (action === "list") setMissions(data);
      else
        setMissions((list) => [...list.filter((m) => m.id !== data.id), data]);
      setMessage(
        "Estado confirmado en almacenamiento. El único ejecutor actual recupera memoria; no ejecuta acciones externas ni funciona 24/7.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error de misión");
    } finally {
      setPending(false);
    }
  }
  async function recommend() {
    if (pending || controller.current) return;
    const abort = new AbortController(); controller.current = abort; setPending(true);
    try {
      const r = await fetch("/api/backend/agents/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        agent: "organization", project, use_memory: shareMemory,
        prompt: `Propón hasta 3 misiones para este objetivo: ${goal.slice(0, 1400) || "Ayúdame a elegir el siguiente objetivo; pregunta si falta contexto"}. Incluye resultado esperado, primer paso, evidencia, datos faltantes y aprobación necesaria. No inventes trabajos realizados. Las propuestas no se ejecutan automáticamente.`,
      }), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(28000)]) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "No se pudieron generar propuestas");
      if (data.provider !== "gemini" || typeof data.text !== "string") throw new Error("No se recibió una propuesta de Gemini");
      setSuggestions(data.text); setMessage("Propuestas recibidas de Gemini. No son acciones ejecutadas ni hechos auditados. Revisa y elige una meta antes de aprobar un plan.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Error al proponer misiones"); }
    finally { controller.current = null; setPending(false); }
  }
  return (
    <section className="jarvis-detail">
      <h2>Misiones reanudables</h2>
      <p className="voice-help">{message}</p>
      <p className="voice-help">Pide ayuda a Gemini para decidir qué hacer. El ejecutor persistente actual solo revisa recuerdos; publicar, enviar mensajes o modificar archivos no está habilitado.</p>
      <label className="voice-consent"><input type="checkbox" checked={shareMemory} onChange={(e) => setShareMemory(e.target.checked)} />Permitir a Gemini consultar los recuerdos pertinentes de este proyecto</label>
      <button type="button" className="private-button secondary" disabled={pending || !geminiEnabled} onClick={() => void recommend()}>Pedir propuestas a Gemini</button>
      {pending && controller.current && <button type="button" className="jarvis-text-link" onClick={() => controller.current?.abort()}>Detener propuestas</button>}
      {suggestions && <article className="gemini-message"><h3>Propuestas para revisar</h3><p style={{ whiteSpace: "pre-wrap" }}>{suggestions}</p></article>}
      <fieldset disabled={pending} className="personal-memory">
        <label>
          Proyecto
          <input
            value={project}
            maxLength={40}
            onChange={(e) => {
              setProject(e.target.value);
              setMissions([]);
            }}
          />
        </label>
        <label>
          Meta autorizada
          <textarea
            maxLength={2000}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="private-button secondary"
          disabled={!goal.trim()}
          onClick={() => void action("create")}
        >
          Crear plan de revisión de memoria
        </button>
        <button
          type="button"
          className="private-button secondary"
          onClick={() => void action("list")}
        >
          Cargar checkpoints
        </button>
        <ul>
          {missions.map((m) => (
            <li key={m.id}>
              <p>{m.goal}</p>
              <p>
                {(
                  {
                    pending_approval: "Pendiente de aprobación",
                    queued: "En cola",
                    working: "Trabajando",
                    paused: "Pausada",
                    blocked: "Bloqueada",
                    completed: "Completada",
                  } as Record<string, string>
                )[m.state] || m.state}{" "}
                · checkpoints: {m.checkpoints.length}
              </p>
              {m.approval && (
                <p>
                  Aprobó {m.approval.actor} · {m.approval.at}
                </p>
              )}
              <button
                type="button"
                className="jarvis-text-link"
                disabled={m.state !== "pending_approval"}
                onClick={() => void action("approve", m.id)}
              >
                Aprobar plan
              </button>
              <button
                type="button"
                className="jarvis-text-link"
                disabled={m.state !== "queued"}
                onClick={() => void action("run_step", m.id)}
              >
                Ejecutar un paso autorizado
              </button>
              <button
                type="button"
                className="jarvis-text-link"
                disabled={!["queued", "working"].includes(m.state)}
                onClick={() => void action("pause", m.id)}
              >
                Pausar
              </button>
              <button
                type="button"
                className="jarvis-text-link"
                disabled={m.state !== "paused"}
                onClick={() => void action("resume", m.id)}
              >
                Reanudar (encolar)
              </button>
            </li>
          ))}
        </ul>
      </fieldset>
    </section>
  );
}
