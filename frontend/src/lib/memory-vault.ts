// Native Web Crypto AES-GCM; no cloud storage or plaintext fallback.
export interface MemoryDocument {
  id: string;
  title: string;
  body: string;
  updated: string;
}
export const MEMORY_SLOT = "jarvis.memory.v1";
const from64 = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
const to64 = (value: Uint8Array) =>
  btoa(Array.from(value, (n) => String.fromCharCode(n)).join(""));
export async function memoryKey(value: string) {
  return crypto.subtle.importKey("raw", from64(value), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function sealMemory(
  key: CryptoKey,
  owner: string,
  documents: MemoryDocument[],
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(`jarvis:memory:v1:${owner}`),
    },
    key,
    new TextEncoder().encode(JSON.stringify(documents)),
  );
  return JSON.stringify({
    v: 1,
    iv: to64(iv),
    ciphertext: to64(new Uint8Array(ciphertext)),
  });
}
export async function openMemory(
  key: CryptoKey,
  owner: string,
  envelope: string,
): Promise<MemoryDocument[]> {
  const parsed = JSON.parse(envelope);
  if (parsed.v !== 1) throw new Error("Formato de memoria incompatible");
  const clear = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: from64(parsed.iv),
      additionalData: new TextEncoder().encode(`jarvis:memory:v1:${owner}`),
    },
    key,
    from64(parsed.ciphertext),
  );
  const docs = JSON.parse(new TextDecoder().decode(clear));
  if (
    !Array.isArray(docs) ||
    docs.length > 32 ||
    docs.some(
      (d) =>
        !d ||
        typeof d.id !== "string" ||
        typeof d.title !== "string" ||
        d.title.length > 160 ||
        typeof d.body !== "string" ||
        d.body.length > 20000 ||
        typeof d.updated !== "string",
    )
  )
    throw new Error("Archivo de memoria inválido");
  return docs;
}
const words = (text: string) =>
  text
    .toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .match(/[\p{L}\p{N}]{3,}/gu) || [];
export function retrieveMemory(documents: MemoryDocument[], query: string) {
  const terms = new Set(words(query));
  // Inspect every document locally. Send only a bounded relevant excerpt, with an honest index.
  const ranked = documents
    .map((d, order) => {
      const chunks = d.body.match(/[\s\S]{1,900}/g) || [""];
      const scored = chunks.map((text) => ({
        text,
        score: words(d.title + " " + text).filter((w) => terms.has(w)).length,
      }));
      scored.sort((a, b) => b.score - a.score);
      return {
        title: d.title,
        text: scored[0].text,
        score: scored[0].score,
        order,
      };
    })
    .sort((a, b) => b.score - a.score || b.order - a.order);
  return {
    memory_index: documents.map((d) => d.title),
    memories: ranked.slice(0, 8).map(({ title, text }) => ({ title, text })),
    inspected: documents.length,
  };
}
