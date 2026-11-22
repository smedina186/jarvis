"use client";
import { useEffect, useState } from "react";
type Item = {
  id: string;
  content: string;
  state: string;
  kind: string;
  source: string;
  conflicts: string[];
};
const labels: Record<string, string> = {
      pending: "Pendiente de configuración",
      active: "Activa y verificada",
      error: "Error",
      prepared_not_connected: "Preparado, no conectado",
      read_verified: "Lectura verificada",
      write_acknowledged_not_read_verified:
        "Escritura aceptada; lectura pendiente",
      error_primary_record_preserved:
        "Error del índice; registro principal conservado",
      error_lexical_fallback: "Error del índice; búsqueda local en la base",
    };
export default function ServerMemory() {
  const [status, setStatus] = useState<{
    state: string;
    reason?: string;
    memanto?: string;
  } | null>(null);
  const [project, setProject] = useState("personal");
  const [items, setItems] = useState<Item[]>([]);
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  async function check() {
    try {
      const r = await fetch("/api/backend/memory/status", {
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });
      if (!r.ok) throw new Error();
      setStatus(await r.json());
    } catch {
      setStatus({
        state: "error",
        reason: "No se pudo verificar la memoria del servidor",
      });
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => void check(), 0);
    return () => clearTimeout(timer);
  }, []);
  async function operate(action: string, id = "") {
    if (pending) return;
    setPending(true);
    setNotice("");
    try {
      const r = await fetch("/api/backend/memory/operate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          project,
          id,
          query,
          ...(action === "remember" || action === "update"
            ? {
                memory: {
                  content,
                  source: action === "update" ? "correction" : "explicit",
                  topic: "",
                },
              }
            : {}),
          confirmation,
        }),
        signal: AbortSignal.timeout(12000),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Memoria no disponible");
      if (action === "list" || action === "recall") setItems(data);
      else if (action === "export") {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "JARVIS-memoria-portable.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } else {
        setNotice(
          "Operación confirmada por el almacenamiento del servidor. Vuelve a cargar la lista para comprobar el resultado.",
        );
        setEditing("");
        setContent("");
        setItems([]);
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Error de memoria");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="jarvis-detail" aria-label="Memoria del servidor">
      <h2>Memoria</h2>
      <p className="voice-help">
        Recuerdos de JARVIS · servidor:{" "}
        {labels[status?.state || ""] || "Sin verificar"}. Memanto:{" "}
        {labels[status?.memanto || ""] || "Sin verificar"}.
      </p>
      {status?.reason && <p className="gemini-error">{status.reason}</p>}
      <p className="voice-help">
        La copia cifrada del navegador sigue disponible en Chat. No se migrará
        ni se enviará a un proveedor nuevo sin tu autorización.
      </p>
      <button
        type="button"
        className="private-button secondary"
        onClick={() => void check()}
      >
        Comprobar memoria
      </button>
      <fieldset
        disabled={status?.state !== "active" || pending}
        className="personal-memory"
      >
        <label>
          Proyecto
          <input
            aria-label="Proyecto de memoria"
            value={project}
            maxLength={40}
            onChange={(e) => {
              setProject(e.target.value);
              setItems([]);
            }}
          />
        </label>
        <label>
          Buscar recuerdos
          <input
            aria-label="Buscar recuerdos"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={1000}
          />
        </label>
        <button
          type="button"
          className="private-button secondary"
          onClick={() => void operate("recall")}
        >
          Buscar
        </button>
        <button
          type="button"
          className="private-button secondary"
          onClick={() => void operate("list")}
        >
          Cargar recuerdos
        </button>
        <label>
          {editing ? "Corregir recuerdo" : "Nuevo recuerdo"}
          <textarea
            value={content}
            maxLength={6000}
            onChange={(e) => setContent(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="private-button secondary"
          disabled={!content.trim()}
          onClick={() => void operate(editing ? "update" : "remember", editing)}
        >
          Guardar recuerdo
        </button>
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <p>{item.content}</p>
              <small>
                {item.kind} · {item.source} · {item.state}
                {item.conflicts?.length ? " · contradicción pendiente" : ""}
              </small>
              <button
                type="button"
                className="jarvis-text-link"
                onClick={() => {
                  setEditing(item.id);
                  setContent(item.content);
                }}
              >
                Corregir / confirmar
              </button>
              <button
                type="button"
                className="jarvis-text-link"
                onClick={() => void operate("forget", item.id)}
              >
                Olvidar
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="private-button secondary"
          onClick={() => void operate("export")}
        >
          Exportar JSON legible
        </button>
        <label>
          Confirmación de borrado global: escribe BORRAR_TODO
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="private-button secondary"
          disabled={confirmation !== "BORRAR_TODO"}
          onClick={() => void operate("forget_owner")}
        >
          Borrar toda mi memoria del servidor
        </button>
      </fieldset>
      {notice && (
        <p role="alert" className="voice-help">
          {notice}
        </p>
      )}
    </section>
  );
}
