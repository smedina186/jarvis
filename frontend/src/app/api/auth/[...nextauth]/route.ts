import { handlers } from "@/auth";
import { authenticationReady } from "@/lib/private-config";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

async function unavailable() {
  return Response.json({ error: "Private login is not configured" }, {
    status: 503, headers: { "Cache-Control": "no-store" },
  });
}

export const GET = (request: NextRequest) => authenticationReady()
  ? handlers.GET(request) : unavailable();
export const POST = (request: NextRequest) => authenticationReady()
  ? handlers.POST(request) : unavailable();
