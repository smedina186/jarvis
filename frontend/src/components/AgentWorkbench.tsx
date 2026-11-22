"use client";
import { useEffect, useRef, useState } from "react";
type Agent = "archivist" | "organization" | "documents";
type Receipt = { id: string; state: string; tools: string[]; memory_ids: string[]; audit_persisted: boolean };
export default function AgentWorkbench() {
  const [agent, setAgent] = useState<Agent>("archivist");
  const [prompt, setPrompt] = useState("");
  const [project, setProject] = useState("personal");
  const [documentText, setDocumentText] = useState("");
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function run() {
    if (controller.current) return;
    const abort = new AbortController(); controller.current = abort;
    setPending(true); setError(""); setReceipt(null); setResult("");
    try {
      const response = await fetch("/api/backend/agents/run", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent, prompt, project, document_text: agent === "documents" ? documentText : "", use_memory: consent }),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(26000)]) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo completar el procedimiento autorizado");
      if (data.provider !== "gemini" || typeof data.text !== "string" || !data.run) throw new Error("No se recibió un resultado verificable del agente");
      setResult(data.text); setReceipt(data.run);
      if (data.document_truncated) setError("Se analizaron solo los primeros 2000 caracteres del documento. Divide el resto en fragmentos.");
    } catch (e) { setError(abort.signal.aborted ? "Espera cancelada; puede haberse iniciado la consulta. No se reintentará sola." : e instanceof Error ? e.message : "Error de agente"); }
    finally { controller.current = null; setPending(false); }
  }
  return <section className="personal-memory" aria-label="Agentes con herramientas">
    <h3>Agentes con herramientas limitadas</h3>
    <p className="voice-help">Integración selectiva de OpenJarvis. Una consulta por solicitud, sin trabajo continuo ni acciones externas. Los textos y recuerdos autorizados se comparten con Gemini para preparar el resultado.</p>
    <fieldset disabled={pending}>
      <label>Procedimiento<select value={agent} onChange={(e) => { setAgent(e.target.value as Agent); setReceipt(null); setResult(""); }}>
        <option value="archivist">Archivista · consultar y revisar recuerdos</option><option value="organization">Organizador · proponer próximos pasos</option><option value="documents">Documentos · analizar texto aportado</option>
      </select></label>
      <label>Proyecto<input value={project} maxLength={40} onChange={(e) => setProject(e.target.value)} /></label>
      <label>Objetivo del agente<textarea value={prompt} maxLength={2000} onChange={(e) => setPrompt(e.target.value)} placeholder="Ejemplo: ¿qué decisiones pendientes encuentras en mis recuerdos?" /></label>
      {agent === "documents" && <label>Texto autorizado del documento<textarea value={documentText} maxLength={6000} onChange={(e) => setDocumentText(e.target.value)} /><small>Solo se analizarán los primeros 2000 caracteres. No pegues credenciales.</small></label>}
      <label className="voice-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />Autorizar la consulta de recuerdos pertinentes de este proyecto y su envío a Gemini</label>
      <button type="button" className="private-button secondary" disabled={!prompt.trim() || !/^[a-zA-Z0-9_-]{1,40}$/.test(project) || (agent === "archivist" && !consent) || (agent === "documents" && !documentText.trim())} onClick={() => void run()}>Ejecutar consulta autorizada</button>
    </fieldset>
    {pending && <><p role="status">Consultando herramientas autorizadas…</p><button type="button" className="jarvis-text-link" onClick={() => controller.current?.abort()}>Cancelar espera del agente</button></>}
    {error && <p className="gemini-error" role="alert">{error}</p>}
    {result && <article className="gemini-message"><h4>Resultado · Gemini</h4><p style={{ whiteSpace: "pre-wrap" }}>{result}</p></article>}
    {receipt && <p className="voice-help">Ejecución {receipt.id} · {receipt.state === "completed" ? "Completada" : receipt.state}<br />Herramientas confirmadas: {receipt.tools.join(", ")}<br />Recuerdos utilizados: {receipt.memory_ids.length} · {receipt.audit_persisted ? "Recibo guardado en Neon" : "No se pudo guardar el recibo"}. No se realizaron acciones externas.</p>}
  </section>;
}
