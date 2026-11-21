"use client";
import { useRef, useState } from "react";
import {
  MEMORY_SLOT,
  memoryKey,
  openMemory,
  sealMemory,
  type MemoryDocument,
} from "@/lib/memory-vault";
export function useMemoryVault() {
  const [documents, setDocuments] = useState<MemoryDocument[]>([]);
  const [state, setState] = useState(
    "Memoria local cifrada · abrir para consultar",
  );
  const context = useRef<{
    key: CryptoKey;
    owner: string;
    docs: MemoryDocument[];
  } | null>(null);
  const loading = useRef<Promise<MemoryDocument[]> | null>(null);
  const mutation = useRef(false);
  async function load() {
    if (context.current) return context.current.docs;
    if (loading.current) return loading.current;
    loading.current = (async () => {
      setState("Abriendo memoria privada…");
      try {
        const response = await fetch("/api/memory/key", {
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok)
          throw new Error("Vuelve a iniciar sesión para abrir la memoria");
        const { key: encoded, owner } = await response.json();
        const key = await memoryKey(encoded);
        const saved = localStorage.getItem(MEMORY_SLOT);
        const docs = saved ? await openMemory(key, owner, saved) : [];
        context.current = { key, owner, docs };
        setDocuments(docs);
        setState("Cifrada en este navegador · sin sincronización automática");
        return docs;
      } catch {
        setState(
          "No se pudo abrir la memoria; el archivo existente no se sobrescribirá.",
        );
        throw new Error("No se pudo abrir la memoria privada");
      } finally {
        loading.current = null;
      }
    })();
    return loading.current;
  }
  async function replace(next: MemoryDocument[]) {
    if (mutation.current)
      throw new Error("Espera a que termine el guardado anterior");
    mutation.current = true;
    try {
      await load();
      const c = context.current!;
      const encrypted = await sealMemory(c.key, c.owner, next);
      localStorage.setItem(MEMORY_SLOT, encrypted);
      c.docs = next;
      setDocuments(next);
      setState("Guardado cifrado en este navegador");
    } finally {
      mutation.current = false;
    }
  }
  async function remember(title: string, body: string) {
    const docs = await load();
    if (!body.trim() || body.length > 20000 || docs.length >= 32)
      throw new Error(
        "Memoria llena o texto inválido: máximo 32 archivos de 20.000 caracteres",
      );
    await replace([
      ...docs,
      {
        id: crypto.randomUUID(),
        title: title.trim().slice(0, 160) || "Información dictada",
        body: body.trim(),
        updated: new Date().toISOString(),
      },
    ]);
  }
  async function update(id: string, title: string, body: string) {
    const docs = await load();
    if (!body.trim() || body.length > 20000)
      throw new Error("Texto vacío o demasiado largo");
    await replace(
      docs.map((doc) =>
        doc.id === id
          ? {
              ...doc,
              title: title.slice(0, 160) || doc.title,
              body: body.trim(),
              updated: new Date().toISOString(),
            }
          : doc,
      ),
    );
  }
  async function remove(id: string) {
    const docs = await load();
    await replace(docs.filter((d) => d.id !== id));
  }
  async function exportFile() {
    const docs = await load();
    const c = context.current!;
    const encrypted = await sealMemory(c.key, c.owner, docs);
    const url = URL.createObjectURL(
      new Blob([encrypted], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "JARVIS-memoria-cifrada.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function restore(file: File) {
    if (file.size > 2000000 || mutation.current)
      throw new Error("Respaldo demasiado grande o guardado en curso");
    mutation.current = true;
    try {
      const response = await fetch("/api/memory/key", {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error("Inicia sesión para restaurar");
      const { key: encoded, owner } = await response.json();
      const key = await memoryKey(encoded);
      const docs = await openMemory(key, owner, await file.text());
      localStorage.setItem(MEMORY_SLOT, await sealMemory(key, owner, docs));
      context.current = { key, owner, docs };
      setDocuments(docs);
      setState("Respaldo restaurado y cifrado");
    } finally {
      mutation.current = false;
    }
  }

  return {
    documents,
    state,
    load,
    remember,
    update,
    remove,
    exportFile,
    restore,
  };
}
