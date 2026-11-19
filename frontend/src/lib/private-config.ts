// RESEARCH: nextauthjs/next-auth, Auth.js GitHub provider and stateless JWT sessions.
// DECISION: Use Auth.js; stateless sessions avoid a database just for one login.
export function ownerId(): string {
  const value = process.env.JARVIS_OWNER_GITHUB_ID ?? "";
  return /^\d+$/.test(value) ? value : "";
}

export function authenticationReady(): boolean {
  try {
    const parsed = new URL(process.env.AUTH_URL ?? "");
    const secure = parsed.protocol === "https:" || (
      process.env.NODE_ENV !== "production" &&
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(parsed.hostname)
    );
    return secure && Boolean(
      ownerId() && process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET &&
      (process.env.AUTH_SECRET?.length ?? 0) >= 32
    );
  } catch {
    return false;
  }
}

export function isOwnerAccount(provider: string, id: string): boolean {
  return provider === "github" && Boolean(ownerId()) && id === ownerId();
}
