import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { permittedBuild, validateConfiguration } from "./netlify-preflight.mjs";

const valid = {
  JARVIS_DEPLOY_APPROVED: "true", CONTEXT: "production", JARVIS_HOSTING_PLAN: "free",
  AUTH_URL: "https://private-example.netlify.app", URL: "https://private-example.netlify.app",
  AUTH_SECRET: "local-test-session-secret-01234567890123456789",
  AUTH_GITHUB_ID: "fake-client", AUTH_GITHUB_SECRET: "fake-client-secret",
  JARVIS_OWNER_GITHUB_ID: "123456", AUTH_TRUST_HOST: "true",
  JARVIS_BACKEND_URL: "https://private-example.onrender.com",
  JARVIS_BACKEND_AUTH_SECRET: "local-test-backend-secret-98765432109876543210",
};

test("builds are locked by default and non-production contexts stay closed", () => {
  assert.equal(permittedBuild({}), false);
  for (const patch of [
    { JARVIS_DEPLOY_APPROVED: "false" }, { CONTEXT: "deploy-preview" },
    { CONTEXT: "branch-deploy" }, { JARVIS_HOSTING_PLAN: "paid" },
  ]) assert.ok(validateConfiguration({ ...valid, ...patch }));
});
test("owner-approved free configuration permits only a build, never calls a deployment API", () => {
  assert.equal(validateConfiguration(valid), null);
});
test("HTTP, missing credentials, reused secrets and AI keys are rejected", () => {
  for (const patch of [
    { AUTH_URL: "http://private-example.netlify.app" }, { AUTH_SECRET: "" },
    { JARVIS_BACKEND_AUTH_SECRET: valid.AUTH_SECRET }, { AUTH_TRUST_HOST: "false" },
    { URL: "https://different.netlify.app" }, { OPENAI_API_KEY: "fake-test-key" },
    { JARVIS_OWNER_GITHUB_ID: "username" },
  ]) assert.ok(validateConfiguration({ ...valid, ...patch }));
});
test("Netlify ignore skips by default and build hooks cannot bypass the command gate", () => {
  const script = new URL("./netlify-preflight.mjs", import.meta.url).pathname;
  assert.equal(spawnSync(process.execPath, [script, "--ignore"], { env: {} }).status, 0);
  assert.equal(spawnSync(process.execPath, [script], { env: {} }).status, 1);
});
