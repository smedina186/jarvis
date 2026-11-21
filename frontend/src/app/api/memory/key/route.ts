// RESEARCH: Web Crypto AES-GCM + Node HMAC; use platform cryptography, no custom cipher.
// DECISION: Per-owner encryption key delivered only after owner authentication, never persisted.
import { createHmac } from "node:crypto";
import { auth } from "@/auth";
import { authenticationReady, ownerId } from "@/lib/private-config";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };
  if (!authenticationReady())
    return Response.json(
      { error: "Acceso sin configurar" },
      { status: 503, headers },
    );
  const session = await auth();
  if (!session?.user || session.user.id !== ownerId())
    return Response.json({ error: "Acceso privado" }, { status: 401, headers });
  const key = createHmac("sha256", process.env.AUTH_SECRET!)
    .update(`jarvis:memory:v1:${ownerId()}`)
    .digest("base64");
  return Response.json({ key, owner: ownerId() }, { headers });
}
