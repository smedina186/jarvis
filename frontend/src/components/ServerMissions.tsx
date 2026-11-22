"use client";
import { useState } from "react";
type Mission = {
  id: string;
  goal: string;
  state: string;
  approval: { actor: string; at: string } | null;
  checkpoints: unknown[];
};
export default function ServerMissions() {
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
  return (
    <section className="jarvis-detail">
      <h2>Misiones reanudables</h2>
      <p className="voice-help">{message}</p>
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
