// This gate checks local configuration, not the billing status of a Netlify account.
// It never calls a provider or deploys anything.
// RESEARCH: Netlify's documented SITE_NAME, BRANCH, CONTEXT and ignore exit codes.
// DECISION: Retain the existing gate, with a project-scoped trial and precise errors.
import { fileURLToPath } from "node:url";

export const approvedSite = "jarvismedina";
export const approvedBranch = "prep/private-personal-assistant";

export function deploymentGateError(env) {
  if (env.CONTEXT !== "production") return "Publication is locked: CONTEXT must be production; previews and branch deploys remain disabled.";
  if (env.JARVIS_DEPLOY_APPROVED !== "true") return "Publication is locked: JARVIS_DEPLOY_APPROVED must be true in the production build environment.";
  if (env.JARVIS_HOSTING_PLAN !== "free") return "Publication is locked: JARVIS_HOSTING_PLAN must be free. Confirm the actual team plan in Netlify Billing before proceeding.";
  if (env.SITE_NAME !== approvedSite) return `Publication is locked: owner authorization applies only to Netlify SITE_NAME=${approvedSite}.`;
  if (env.BRANCH !== approvedBranch) return `Publication is locked: the production branch must be ${approvedBranch}; main is not authorized.`;
  return null;
}

export function permittedBuild(env) {
  return deploymentGateError(env) === null;
}

export function validateConfiguration(env) {
  const gateError = deploymentGateError(env);
  if (gateError) return gateError;
  const required = ["AUTH_URL", "AUTH_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET",
    "JARVIS_OWNER_GITHUB_ID", "JARVIS_BACKEND_URL", "JARVIS_BACKEND_AUTH_SECRET"];
  const missing = required.filter((key) => !env[key]);
  if (missing.length) return `Private authentication configuration is incomplete. Set these server-only variables for production Builds and Functions: ${missing.join(", ")}.`;
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
    const error = validateConfiguration(process.env);
    console.log(error ? `Build skipped: ${error}` : "Owner-authorized jarvismedina trial build requested.");
    // Netlify: 0 skips a Git-triggered build; 1 allows it to continue.
    // Check all prerequisites here to avoid wasting a build on missing secrets.
    process.exit(error ? 0 : 1);
  }
  const error = validateConfiguration(process.env);
  if (error) { console.error(error); process.exit(1); }
  console.log("Configuration passed for the authorized jarvismedina trial. The Free plan was confirmed by the owner; this script cannot inspect billing.");
}
