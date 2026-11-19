// This gate checks local configuration, not the billing status of a Netlify account.
// It never calls a provider or deploys anything.
import { fileURLToPath } from "node:url";

export function permittedBuild(env) {
  return env.JARVIS_DEPLOY_APPROVED === "true" &&
    env.CONTEXT === "production" && env.JARVIS_HOSTING_PLAN === "free";
}

export function validateConfiguration(env) {
  if (!permittedBuild(env)) return "Publication is locked; owner authorization and Free plan are required.";
  const required = ["AUTH_URL", "AUTH_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET",
    "JARVIS_OWNER_GITHUB_ID", "JARVIS_BACKEND_URL", "JARVIS_BACKEND_AUTH_SECRET"];
  if (required.some((key) => !env[key])) return "Private authentication configuration is incomplete.";
  if (!/^\d+$/.test(env.JARVIS_OWNER_GITHUB_ID)) return "Owner must be a numeric GitHub ID.";
  if ([env.AUTH_SECRET, env.JARVIS_BACKEND_AUTH_SECRET].some((key) => Buffer.byteLength(key) < 32) ||
    env.AUTH_SECRET === env.JARVIS_BACKEND_AUTH_SECRET) return "Use two distinct strong server-only secrets.";
  try {
    const app = new URL(env.AUTH_URL);
    const backend = new URL(env.JARVIS_BACKEND_URL);
    if (app.protocol !== "https:" || backend.protocol !== "https:") return "HTTPS is required.";
    if (env.URL && app.origin !== new URL(env.URL).origin) return "AUTH_URL must match the primary site URL.";
  } catch { return "Invalid application or backend URL."; }
  if (env.AUTH_TRUST_HOST !== "true") return "AUTH_TRUST_HOST=true is required behind Netlify's proxy.";
  const serviceKeys = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY",
    "BROWSER_USE_API_KEY", "EXA_API_KEY", "NETLIFY_AI_GATEWAY_KEY"];
  if (serviceKeys.some((key) => env[key])) return "Remove external AI/service credentials: this project is demo-only.";
  return null;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes("--ignore")) {
    console.log(permittedBuild(process.env) ? "Owner-authorized production build requested." : "Build skipped: publication locked.");
    // Netlify: 0 skips a Git-triggered build; 1 allows it to continue.
    process.exit(permittedBuild(process.env) ? 1 : 0);
  }
  const error = validateConfiguration(process.env);
  if (error) { console.error(error); process.exit(1); }
  console.log("Configuration passed. Verify the actual Free plan in the provider dashboard.");
}
