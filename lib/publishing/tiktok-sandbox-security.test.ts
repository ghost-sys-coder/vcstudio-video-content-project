import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { tikTokSandboxCredentialsSchema } from "@studio/contracts/publishing";
import {
  createTikTokOAuthSession,
  readTikTokOAuthSession,
} from "./tiktok-oauth-session";
import {
  readTikTokSandboxCredentials,
  sealTikTokSandboxCredentials,
} from "./tiktok-sandbox-credentials";

const key = Buffer.alloc(32, 4).toString("base64");
const workspaceId = "11111111-1111-4111-8111-111111111111";
const credentials = {
  clientKey: "sandbox-app-1",
  clientSecret: "sandbox-secret-1",
};
const session = {
  ...credentials,
  workspaceId,
  userId: "owner-1",
  state: "signed-state",
  expiresAtMs: 2000,
};
const read = {
  key,
  workspaceId,
  userId: session.userId,
  state: session.state,
  now: new Date(1000),
};

describe("TikTok sandbox credential and browser binding", () => {
  it("validates and bounds app credentials without accepting blank values", () => {
    expect(
      tikTokSandboxCredentialsSchema.parse({
        clientKey: " app ",
        clientSecret: " secret ",
      }),
    ).toEqual({ clientKey: "app", clientSecret: "secret" });
    for (const input of [
      { clientKey: "", clientSecret: "secret" },
      { ...credentials, clientSecret: "x".repeat(257) },
      { ...credentials, clientKey: "key with spaces" },
    ])
      expect(tikTokSandboxCredentialsSchema.safeParse(input).success).toBe(
        false,
      );
  });
  it("seals ephemeral credentials and returns only the matching browser flow", () => {
    const sealed = createTikTokOAuthSession(session, key);
    expect(sealed).not.toContain(credentials.clientSecret);
    expect(readTikTokOAuthSession({ ...read, sealed })).toEqual(credentials);
  });
  it.each([
    { userId: "another-owner" },
    { workspaceId: "another-workspace" },
    { state: "another-flow" },
    { now: new Date(2000) },
    { key: Buffer.alloc(32, 5).toString("base64") },
  ])("rejects changed or expired authorization: %j", (change) => {
    expect(() =>
      readTikTokOAuthSession({
        ...read,
        sealed: createTikTokOAuthSession(session, key),
        ...change,
      }),
    ).toThrow("expired or changed");
  });
  it("rejects tampered and missing browser cookies", () => {
    for (const sealed of ["", "v1.bad.bad.bad"])
      expect(() => readTikTokOAuthSession({ ...read, sealed })).toThrow(
        "expired or changed",
      );
  });
  it("binds persisted app credentials to the exact workspace and account", () => {
    const oauthClientCredentialsSealed = sealTikTokSandboxCredentials({
      credentials,
      workspaceId,
      externalAccountId: "account-1",
      key,
    });
    const connection = {
      platform: "tiktok",
      workspaceId,
      externalAccountId: "account-1",
      oauthClientCredentialsSealed,
    };
    expect(readTikTokSandboxCredentials(connection, key)).toEqual(credentials);
    for (const change of [
      { platform: "youtube" },
      { workspaceId: "another-workspace" },
      { externalAccountId: "another-account" },
      { oauthClientCredentialsSealed: "malformed" },
    ])
      expect(() =>
        readTikTokSandboxCredentials({ ...connection, ...change }, key),
      ).toThrow("Reconnect");
    expect(
      readTikTokSandboxCredentials({ platform: "tiktok" }, key),
    ).toBeNull();
  });
});
