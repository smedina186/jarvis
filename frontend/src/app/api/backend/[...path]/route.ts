import { SignJWT } from "jose";
import { auth } from "@/auth";
import { authenticationReady, ownerId } from "@/lib/private-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store, private" };
const readablePaths = new Set(["health", "services", "gemini/status"]);

async function proxy(
  request: Request, context: { params: Promise<{ path: string[] }> }, method: "GET" | "POST",
) {
  if (!authenticationReady()) return Response.json({ error: "Login not configured" }, {
    status: 503, headers,
  });
  const session = await auth();
  if (!session?.user || session.user.id !== ownerId()) {
    return Response.json({ error: "Owner authentication required" }, { status: 401, headers });
  }
  const { path } = await context.params;
  if (!(method === "GET" ? readablePaths.has(path.join("/")) : path.join("/") === "chat")) {
    return Response.json({ error: "This tool is disabled" }, { status: 403, headers });
  }
  let body: string | undefined;
  if (method === "POST") {
    if (!process.env.AUTH_URL || request.headers.get("origin") !== new URL(process.env.AUTH_URL).origin) {
      return Response.json({ error: "Origen no autorizado" }, { status: 403, headers });
    }
    if (!request.headers.get("content-type")?.startsWith("application/json")) {
      return Response.json({ error: "Se requiere JSON" }, { status: 415, headers });
    }
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ error: "Mensaje vacío" }, { status: 400, headers });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 100000) { await reader.cancel(); return Response.json({ error: "Conversación demasiado larga" }, { status: 413, headers }); }
      chunks.push(value);
    }
    body = Buffer.concat(chunks).toString("utf8");
    try { JSON.parse(body); } catch { return Response.json({ error: "JSON inválido" }, { status: 400, headers }); }
  }
  const secret = process.env.JARVIS_BACKEND_AUTH_SECRET;
  const backend = process.env.JARVIS_BACKEND_URL;
  if (!backend || !secret || secret.length < 32 || secret === process.env.AUTH_SECRET) {
    return Response.json({ error: "Private backend not configured" }, { status: 503, headers });
  }
  try {
    const target = new URL(backend);
    if (target.protocol !== "https:" && !(process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1"].includes(target.hostname) && target.protocol === "http:")) {
      throw new Error("HTTPS required");
    }
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" }).setSubject(ownerId())
      .setIssuer("jarvis-web").setAudience("jarvis-api")
      .setIssuedAt().setExpirationTime("60s")
      .sign(new TextEncoder().encode(secret));
    const response = await fetch(new URL(`/api/${path.join("/")}`, target), {
      method, body,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      cache: "no-store", redirect: "error", signal: AbortSignal.any([request.signal, AbortSignal.timeout(method === "POST" ? 25000 : 10000)]),
    });
    const data = await response.json();
    // Upstream JWT failure must not masquerade as a lost browser OAuth session.
    // Otherwise /login can redirect the still-authenticated owner back into a loop.
    if (response.status === 401 || (response.status === 403 && method === "GET")) {
      return Response.json({ error: "Render rechazó la credencial privada. Comprueba que JARVIS_BACKEND_AUTH_SECRET y JARVIS_OWNER_GITHUB_ID coincidan en Render y Netlify." }, { status: 502, headers });
    }
    if (response.status === 503 && data.detail === "Private access is not configured") {
      return Response.json({ error: "Falta configurar el acceso privado en Render: JARVIS_OWNER_GITHUB_ID y JARVIS_BACKEND_AUTH_SECRET (mínimo 32 bytes)." }, { status: 503, headers });
    }
    const resultHeaders: Record<string, string> = { ...headers };
    const retry = response.headers.get("retry-after");
    if (retry && /^\d{1,5}$/.test(retry)) resultHeaders["Retry-After"] = retry;
    if (!response.ok) return Response.json({ error: typeof data.detail === "string" ? data.detail : "Solicitud rechazada por el backend privado." }, { status: response.status, headers: resultHeaders });
    return Response.json(data, { status: response.status, headers: resultHeaders });
  } catch {
    return Response.json({ error: "Private backend unavailable" }, { status: 502, headers });
  }
}

export function GET(request: Request, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context, "GET");
}
export async function POST(request: Request, context: { params: Promise<{ path: string[] }> }) {
  // Preserve the unconditional legacy-tool deny response; only chat may proceed to auth.
  const { path } = await context.params;
  if (path.join("/") !== "chat") return Response.json({ error: "Agent execution is disabled" }, { status: 403, headers });
  return proxy(request, context, "POST");
}
