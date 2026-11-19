import { defineConfig, devices } from "@playwright/test";

// Local test credentials only. No OAuth/API provider is contacted by this suite.
const testSecret = "local-e2e-test-backend-secret-not-for-production-012345";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
    { name: "iphone-layout", use: { ...devices["iPhone 13"], browserName: "chromium" } },
    { name: "ipad-layout", use: { ...devices["iPad Mini"], browserName: "chromium" } },
    { name: "iphone-webkit", use: { ...devices["iPhone 13"], browserName: "webkit" } },
    { name: "ipad-webkit", use: { ...devices["iPad Mini"], browserName: "webkit" } },
  ],
  webServer: [
    {
      command: "uv run --directory ../backend uvicorn private_main:app --host 127.0.0.1 --port 8100",
      url: "http://127.0.0.1:8100/healthz",
      reuseExistingServer: false,
      env: {
        JARVIS_OWNER_GITHUB_ID: "123456",
        JARVIS_BACKEND_AUTH_SECRET: testSecret,
        JARVIS_PERSONAL_MODE: "true",
      },
    },
    {
      command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
      url: "http://127.0.0.1:3100/login",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        AUTH_URL: "http://127.0.0.1:3100",
        AUTH_TRUST_HOST: "true",
        AUTH_SECRET: "local-e2e-test-session-secret-not-for-production-098765",
        AUTH_GITHUB_ID: "fake-client-no-external-oauth",
        AUTH_GITHUB_SECRET: "fake-client-secret",
        JARVIS_OWNER_GITHUB_ID: "123456",
        JARVIS_BACKEND_URL: "http://127.0.0.1:8100",
        JARVIS_BACKEND_AUTH_SECRET: testSecret,
      },
    },
  ],
});
