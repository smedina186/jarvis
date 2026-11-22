"use client";
import { useEffect, useRef, useState } from "react";
type Item = { id: string; content: string; state: string; kind: string; source: string; conflicts: string[] };
type Status = { state: string; reason?: string; memanto?: string };
const kinds: Record<string, string> = { preference: "Preferencias", decision: "Decisiones", goal: "Objetivos", fact: "Hechos aportados", context: "Contexto", learning: "Aprendizajes", error: "Errores" };
export default function ServerMemory() {
  const [status, setStatus] = useState<Status | null>(null);
  const [project, setProject] = useState("personal");
  const [projects, setProjects] = useState<string[]>(["personal"]);
  const [items, setItems] = useState<Item[]>([]);
  const [content, setContent] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [checkedAt, setCheckedAt] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const busy = useRef(false);
  const current = useRef(true);
  async function request(action: string, selected = project, id = "") {
    const r = await fetch("/api/backend/memory/operate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, project: selected, id, query, confirmation,
        ...(["remember", "update"].includes(action) ? { memory: { content, source: action === "update" ? "correction" : "explicit", topic: "" } } : {}) }),
      signal: AbortSignal.timeout(12000),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Memoria no disponible");
    return data;
  }
  async function check() {
    if (busy.current) return;
    busy.current = true; setPending(true); setNotice("");
    try {
      const r = await fetch("/api/backend/memory/status", { cache: "no-store", signal: AbortSignal.timeout(12000) });
      if (!r.ok) throw new Error("No se pudo verificar la memoria del servidor");
      const result: Status = await r.json();
      if (!current.current) return;
      setStatus(result); setCheckedAt(new Date().toLocaleTimeString("es"));
      if (result.state === "active") {
        const folders = await request("projects");
        if (Array.isArray(folders)) setProjects([...new Set(["personal", ...folders])]);
        const records = await request("list");
        if (current.current && Array.isArray(records)) setItems(records);
        setNotice("Conexión comprobada. Recuerdos cargados desde Neon.");
      }
    } catch (e) {
      if (current.current) setNotice(e instanceof Error ? e.message : "Error al comprobar memoria");
    } finally { busy.current = false; if (current.current) setPending(false); }
  }
  useEffect(() => {
    current.current = true;
    const timer = setTimeout(() => void check(), 0);
    return () => { current.current = false; clearTimeout(timer); };
    // One load on opening; no polling or model calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function operate(action: string, id = "", selected = project) {
    if (busy.current) return;
    busy.current = true; setPending(true); setNotice("");
    try {
      const data = await request(action, selected, id);
      if (["list", "recall"].includes(action)) {
        if (!Array.isArray(data)) throw new Error("Lista de recuerdos inválida");
        setItems(data); setNotice(`${data.length} recuerdos recuperados del servidor.`);
      } else if (action === "export") {
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
        const a = document.createElement("a"); a.href = url; a.download = `JARVIS-memoria-${selected}.json`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setNotice("Exportación preparada. El archivo contiene información privada.");
      } else {
        setEditing(""); setContent(""); setConfirmation("");
        const records = await request("list", selected);
        setItems(Array.isArray(records) ? records : []);
        setProjects((p) => [...new Set([...p, selected])]);
        setNotice("Cambio confirmado y lista actualizada desde el almacenamiento.");
      }
    } catch (e) { setNotice(e instanceof Error ? e.message : "Error de memoria"); }
    finally { busy.current = false; setPending(false); }
  }
  return <section className="jarvis-detail" aria-label="Memoria del servidor">
    <h2>Recuerdos de JARVIS</h2>
    <p className="voice-help">{status?.state === "active" ? "Neon · almacenamiento activo y verificado" : status?.state === "pending" ? "Memoria pendiente de configuración" : status?.state === "error" ? "Error de almacenamiento" : "Sin verificar"}. Memanto: preparado, no conectado.</p>
    {status?.reason && <p className="gemini-error">{status.reason}</p>}
    <p className="voice-help">Carpetas por proyecto. Puedes decir en el chat «JARVIS, recuerda que…» con memoria del servidor activada. Solo se guardan recuerdos explícitos; no toda la conversación.</p>
    <button type="button" className="private-button secondary" disabled={pending} aria-busy={pending} onClick={() => void check()}>{pending ? "Cargando memoria…" : "Comprobar memoria"}</button>
    {checkedAt && <p className="voice-help">Última comprobación: {checkedAt}</p>}
    {notice && <p role="status" aria-live="polite" className="voice-help">{notice}</p>}
    <nav className="jarvis-memory-folders" aria-label="Carpetas de recuerdos">{projects.map((folder) => <button key={folder} type="button" className="private-button secondary" aria-pressed={folder === project} disabled={pending || status?.state !== "active"} onClick={() => { setProject(folder); setItems([]); void operate("list", "", folder); }}>📁 {folder === "personal" ? "Personal" : folder}</button>)}</nav>
    <fieldset disabled={status?.state !== "active" || pending} className="personal-memory">
      <label>Buscar recuerdos<input aria-label="Buscar recuerdos" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={1000} /></label>
      <button type="button" className="private-button secondary" onClick={() => void operate("recall")}>Buscar</button>
      <button type="button" className="private-button secondary" onClick={() => void operate("list")}>Cargar recuerdos</button>
      {!items.length && <p className="voice-help">Esta carpeta aún no muestra recuerdos. Crea uno o cambia de proyecto.</p>}
      {Object.entries(kinds).map(([kind, title]) => {
        const records = items.filter((i) => i.kind === kind && i.state !== "deleted");
        if (!records.length) return null;
        return <details className="jarvis-memory-group" key={kind} open><summary>{title} · {records.length}</summary><ul>{records.map((item) => <li key={item.id}><p>{item.content}</p><small>{item.source === "inference" ? "Inferencia pendiente de revisión" : "Dato aportado"} · {item.state === "active" ? "Activo" : item.state}{item.conflicts?.length ? " · contradicción pendiente" : ""}</small><div><button type="button" className="jarvis-text-link" onClick={() => { setEditing(item.id); setContent(item.content); }}>Corregir / confirmar</button><button type="button" className="jarvis-text-link" onClick={() => { if (window.confirm("¿Olvidar este recuerdo?")) void operate("forget", item.id); }}>Olvidar</button></div></li>)}</ul></details>;
      })}
      <details open={Boolean(editing)}><summary>{editing ? "Corregir recuerdo" : "Añadir recuerdo o carpeta"}</summary>
        <label>Proyecto<input aria-label="Proyecto de memoria" value={project} maxLength={40} pattern="[a-zA-Z0-9_-]{1,40}" onChange={(e) => { setProject(e.target.value); setItems([]); setEditing(""); }} /></label>
        <label>{editing ? "Corregir recuerdo" : "Nuevo recuerdo"}<textarea value={content} maxLength={6000} onChange={(e) => setContent(e.target.value)} /></label>
        <button type="button" className="private-button secondary" disabled={!content.trim() || !/^[a-zA-Z0-9_-]{1,40}$/.test(project)} onClick={() => void operate(editing ? "update" : "remember", editing)}>Guardar recuerdo</button>
      </details>
      <button type="button" className="private-button secondary" onClick={() => void operate("export")}>Exportar JSON legible</button>
      <details><summary>Privacidad y borrado</summary><p className="voice-help">La copia cifrada del navegador sigue disponible en Chat. No se migra automáticamente. Los recuerdos del servidor se guardan en Neon; Gemini solo recibe los pertinentes cuando lo autorizas en Chat.</p>
        <label>Confirmación de borrado global: escribe BORRAR_TODO<input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>
        <button type="button" className="private-button secondary" disabled={confirmation !== "BORRAR_TODO"} onClick={() => void operate("forget_owner")}>Borrar toda mi memoria del servidor</button>
      </details>
    </fieldset>
  </section>;
}
