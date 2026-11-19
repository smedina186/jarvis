import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticationReady, isOwnerAccount, ownerId } from "../private-config";

afterEach(() => vi.unstubAllEnvs());
describe("Single owner authentication", () => {
  it("does not allow missing, malformed or different IDs", () => {
    vi.stubEnv("JARVIS_OWNER_GITHUB_ID", "");
    expect(isOwnerAccount("github", "")).toBe(false);
    vi.stubEnv("JARVIS_OWNER_GITHUB_ID", "smedina186");
    expect(ownerId()).toBe("");
    vi.stubEnv("JARVIS_OWNER_GITHUB_ID", "123456");
    expect(isOwnerAccount("github", "other")).toBe(false);
    expect(isOwnerAccount("google", "123456")).toBe(false);
    expect(isOwnerAccount("github", "123456")).toBe(true);
  });
  it("requires OAuth credentials, a strong session secret and HTTPS in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JARVIS_OWNER_GITHUB_ID", "123456");
    vi.stubEnv("AUTH_GITHUB_ID", "test-client");
    vi.stubEnv("AUTH_GITHUB_SECRET", "test-client-secret");
    vi.stubEnv("AUTH_SECRET", "x".repeat(48));
    vi.stubEnv("AUTH_URL", "http://localhost:3000");
    expect(authenticationReady()).toBe(false);
    vi.stubEnv("AUTH_URL", "https://private.example.com");
    expect(authenticationReady()).toBe(true);
    vi.stubEnv("AUTH_SECRET", "short");
    expect(authenticationReady()).toBe(false);
  });
});
