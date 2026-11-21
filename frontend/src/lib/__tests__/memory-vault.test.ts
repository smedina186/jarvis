import { webcrypto } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import {
  memoryKey,
  sealMemory,
  openMemory,
  retrieveMemory,
} from "../memory-vault";
afterEach(() => vi.unstubAllGlobals());
it("keeps durable files encrypted and rejects a different owner and tampered ciphertext", async () => {
  vi.stubGlobal("crypto", webcrypto);
  const key = await memoryKey(Buffer.alloc(32, 7).toString("base64"));
  const docs = [
    {
      id: "1",
      title: "Empresa",
      body: "Mi empresa vende muebles",
      updated: "2026-11-21",
    },
  ];
  const first = await sealMemory(key, "123", docs);
  expect(first).not.toContain("muebles");
  expect(first).not.toContain("Empresa");
  expect(await openMemory(key, "123", first)).toEqual(docs);
  await expect(openMemory(key, "456", first)).rejects.toThrow();
  const changed = JSON.parse(first);
  changed.ciphertext = "AAAA" + changed.ciphertext.slice(4);
  await expect(
    openMemory(key, "123", JSON.stringify(changed)),
  ).rejects.toThrow();
  expect(await sealMemory(key, "123", docs)).not.toEqual(first);
});
it("inspects the whole index while limiting model context and disclosing selected sources", () => {
  const docs = Array.from({ length: 20 }, (_, i) => ({
    id: String(i),
    title: `Archivo ${i}`,
    body: i === 3 ? "Campaña de muebles Meta Ads" : "Información general",
    updated: "hoy",
  }));
  const result = retrieveMemory(docs, "Meta Ads muebles");
  expect(result.inspected).toBe(20);
  expect(result.memory_index).toHaveLength(20);
  expect(result.memories).toHaveLength(8);
  expect(result.memories[0].title).toBe("Archivo 3");
});
