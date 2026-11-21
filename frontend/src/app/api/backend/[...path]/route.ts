import { SignJWT } from "jose";
import { auth } from "@/auth";
import { authenticationReady, ownerId } from "@/lib/private-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store, private" };
const readablePaths = new Set(["health", "services"]);

export async function GET(
  _request: Request, context: { params: Promise<{ path: string[] }> },
) {
  if (!authenticationReady()) return Response.json({ error: "Login not configured" }, {
    status: 503, headers,
  });
  const session = await auth();
  if (!session?.user || session.user.id !== ownerId()) {
    return Response.json({ error: "Owner authentication required" }, { status: 401, headers });
  }
  const { path } = await context.params;
  if (!readablePaths.has(path.join("/"))) {
    return Response.json({ error: "This tool is disabled" }, { status: 403, headers });
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
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    // Upstream JWT failure must not masquerade as a lost browser OAuth session.
    // Otherwise /login can redirect the still-authenticated owner back into a loop.
    if (response.status === 401 || response.status === 403) {
      return Response.json({ error: "Render rechazó la credencial privada. Comprueba que JARVIS_BACKEND_AUTH_SECRET y JARVIS_OWNER_GITHUB_ID coincidan en Render y Netlify." }, { status: 502, headers });
    }
    if (response.status === 503) {
      return Response.json({ error: "Falta configurar el acceso privado en Render: JARVIS_OWNER_GITHUB_ID y JARVIS_BACKEND_AUTH_SECRET (mínimo 32 bytes)." }, { status: 503, headers });
    }
    return Response.json(data, { status: response.status, headers });
  } catch {
    return Response.json({ error: "Private backend unavailable" }, { status: 502, headers });
  }
}

export async function POST() {
  return Response.json({ error: "Agent execution is disabled" }, { status: 403, headers });
}
