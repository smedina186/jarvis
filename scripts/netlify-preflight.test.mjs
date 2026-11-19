import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { deploymentGateError, permittedBuild, validateConfiguration } from "./netlify-preflight.mjs";

const valid = {
  JARVIS_DEPLOY_APPROVED: "true", CONTEXT: "production", JARVIS_HOSTING_PLAN: "free",
  SITE_NAME: "jarvismedina", BRANCH: "prep/private-personal-assistant",
  AUTH_URL: "https://jarvismedina.netlify.app", URL: "https://jarvismedina.netlify.app",
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
    { SITE_NAME: "another-project" }, { SITE_NAME: undefined },
    { BRANCH: "main" }, { BRANCH: undefined },
  ]) assert.ok(validateConfiguration({ ...valid, ...patch }));
});
test("owner-approved free configuration permits only a build, never calls a deployment API", () => {
  assert.equal(validateConfiguration(valid), null);
});
test("blocked builds identify the failed condition instead of a generic authorization error", () => {
  for (const [key, value] of Object.entries({ CONTEXT: "branch-deploy", JARVIS_DEPLOY_APPROVED: "false",
    JARVIS_HOSTING_PLAN: "paid", SITE_NAME: "other", BRANCH: "main" })) {
    assert.match(deploymentGateError({ ...valid, [key]: value }), new RegExp(key === "BRANCH" ? "production branch" : key));
  }
});
test("missing server secrets are named without exposing any values", () => {
  const error = validateConfiguration({ ...valid, AUTH_GITHUB_SECRET: "", JARVIS_BACKEND_AUTH_SECRET: "" });
  assert.match(error, /AUTH_GITHUB_SECRET/);
  assert.match(error, /JARVIS_BACKEND_AUTH_SECRET/);
  assert.ok(!error.includes(valid.AUTH_SECRET));
});
test("HTTP, missing credentials, reused secrets and AI keys are rejected", () => {
  for (const patch of [
    { AUTH_URL: "http://jarvismedina.netlify.app" }, { AUTH_SECRET: "" },
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
test("ignore skips incomplete or unauthorized builds, and continues only a fully configured trial", () => {
  const script = new URL("./netlify-preflight.mjs", import.meta.url).pathname;
  for (const env of [{ ...valid, AUTH_SECRET: "" }, { ...valid, SITE_NAME: "other" },
    { ...valid, JARVIS_HOSTING_PLAN: "paid" }, { ...valid, BRANCH: "main" }]) {
    const result = spawnSync(process.execPath, [script, "--ignore"], { env, encoding: "utf8" });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Build skipped:/);
  }
  assert.equal(spawnSync(process.execPath, [script, "--ignore"], { env: valid }).status, 1);
});
