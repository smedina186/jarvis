"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PrivateDashboard() {
  const router = useRouter();
  const [status, setStatus] = useState("Comprobando conexión privada…");
  const [pending, setPending] = useState(false);
  const check = useCallback(async () => {
    setPending(true);
    try {
      const response = await fetch("/api/backend/health", {
        cache: "no-store", signal: AbortSignal.timeout(12000),
      });
      if (response.status === 401) { router.replace("/login"); return; }
      const data = await response.json();
      setStatus(response.ok && data.status === "ok"
        ? "Backend privado conectado"
        : "Backend pendiente de configuración o no disponible");
    } catch {
      setStatus("No se pudo conectar al backend privado");
    } finally { setPending(false); }
  }, [router]);
  useEffect(() => { const initial = setTimeout(check, 0); return () => clearTimeout(initial); }, [check]);

  return (
    <>
      <section className="private-card">
        <p className="private-eyebrow">TU ESPACIO</p>
        <h2>Bienvenido a JARVIS</h2>
        <p>Accede desde Safari o cualquier navegador. Esta versión prepara el acceso privado;
          el chat y la ejecución de agentes siguen pendientes.</p>
        <div className="private-connection">
          <p role="status" aria-live="polite">{status}</p>
          <button className="private-button secondary" onClick={check} disabled={pending}>
            {pending ? "Comprobando…" : "Comprobar conexión"}
          </button>
        </div>
      </section>
      <section className="private-grid" aria-label="Capacidades de JARVIS">
        {[
          ["Chat con IA", "Pendiente", "No hay un proveedor conectado ni respuestas simuladas presentadas como reales."],
          ["Agentes especializados", "Desactivados", "Ninguna tarea externa se ejecuta desde este panel."],
          ["Privacidad", "Modo privado", "Reconocimiento facial e investigación de personas bloqueados."],
          ["Tiempo real", "Desactivado", "Convex, cámara y voz no abren conexiones desde este panel."],
        ].map(([title, badge, detail]) => (
          <article className="private-card" key={title}>
            <span className="private-badge">{badge}</span><h2>{title}</h2><p>{detail}</p>
          </article>
        ))}
      </section>
    </>
  );
}
