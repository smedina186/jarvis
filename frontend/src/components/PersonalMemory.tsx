"use client";
import { useState } from "react";
import type { useMemoryVault } from "@/hooks/useMemoryVault";
interface Props {
  vault: ReturnType<typeof useMemoryVault>;
  draft: string;
  useMemory: boolean;
  onUse: (enabled: boolean) => void;
}
export default function PersonalMemory({
  vault,
  draft,
  useMemory,
  onUse,
}: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const run = (action: Promise<unknown>) => {
    setError("");
    void action.catch((e) =>
      setError(e instanceof Error ? e.message : "No se pudo guardar"),
    );
  };
  return (
    <details
      className="personal-memory"
      onToggle={(e) => {
        if (e.currentTarget.open) run(vault.load());
      }}
    >
      <summary>
        Memoria personal y de empresa · {vault.documents.length} archivos
      </summary>
      <p className="voice-help">
        Cuéntame la información con el micrófono y guárdala aquí. Se conserva
        cifrada en este navegador; exporta el respaldo para llevarla a otro
        dispositivo. No se guarda en GitHub ni en Render.
      </p>
      <label>
        Título del recuerdo
        <input
          aria-label="Título del recuerdo"
          maxLength={160}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Mi empresa, productos, clientes…"
        />
      </label>
      <button
        type="button"
        className="private-button secondary"
        disabled={!draft.trim()}
        onClick={() => run(vault.remember(title, draft))}
      >
        Guardar lo que acabo de contar
      </button>
      <label className="voice-consent">
        <input
          type="checkbox"
          checked={useMemory}
          onChange={(e) => {
            onUse(e.target.checked);
            if (e.target.checked) run(vault.load());
          }}
        />{" "}
        Usar mi memoria al responder: enviar a Google los fragmentos
        seleccionados
      </label>
      <p className="voice-help">
        {vault.state}. Cambiar AUTH_SECRET hace ilegibles los respaldos
        antiguos.
      </p>
      <ul>
        {vault.documents.map((doc) => (
          <li key={doc.id}>
            <details>
              <summary>{doc.title}</summary>
              <p>{doc.body}</p>
              <small>{doc.updated}</small>
              <button
                type="button"
                className="jarvis-text-link"
                onClick={() => {
                  setEditing(doc.id);
                  setEditBody(doc.body);
                }}
              >
                Corregir recuerdo
              </button>
              {editing === doc.id && (
                <>
                  <textarea
                    aria-label="Corregir contenido del recuerdo"
                    maxLength={20000}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                  />
                  <button
                    type="button"
                    className="private-button secondary"
                    onClick={() => {
                      run(vault.update(doc.id, doc.title, editBody));
                      setEditing(null);
                    }}
                  >
                    Guardar corrección
                  </button>
                </>
              )}
            </details>
            <button
              type="button"
              className="jarvis-text-link"
              onClick={() => run(vault.remove(doc.id))}
            >
              Borrar recuerdo
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="private-button secondary"
        onClick={() => run(vault.exportFile())}
      >
        Exportar memoria cifrada
      </button>
      <label className="voice-help">
        Restaurar respaldo (reemplaza la memoria de este navegador)
        <input
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) run(vault.restore(file));
            e.target.value = "";
          }}
        />
      </label>
      <label className="voice-help">
        Añadir archivo de texto (TXT, MD, CSV o JSON)
        <input
          type="file"
          accept=".txt,.md,.csv,.json,text/plain"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && file.size <= 80000)
              run(file.text().then((body) => vault.remember(file.name, body)));
            else setError("Archivo demasiado grande");
            e.target.value = "";
          }}
        />
      </label>
      {error && <p className="gemini-error">{error}</p>}
    </details>
  );
}
