import { describe, expect, it } from "vitest";
import {
  createFacebookOAuthSession,
  readFacebookOAuthSession,
} from "@/lib/publishing/facebook-oauth-session";

const key = Buffer.alloc(32, 7).toString("base64");

describe("Facebook OAuth selection session", () => {
  it("round trips an encrypted, unexpired session", () => {
    const expiresAtMs = Date.parse("2026-07-22T12:10:00.000Z");
    const sealed = createFacebookOAuthSession(
      {
        workspaceId: "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
        userId: "user_1",
        userAccessToken: "secret-user-token",
        scopes: ["pages_show_list"],
        expiresAtMs,
      },
      key,
    );
    expect(sealed).not.toContain("secret-user-token");
    expect(
      readFacebookOAuthSession({
        sealed,
        key,
        now: new Date("2026-07-22T12:00:00.000Z"),
      }).userAccessToken,
    ).toBe("secret-user-token");
  });

  it("rejects an expired session", () => {
    const sealed = createFacebookOAuthSession(
      {
        workspaceId: "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
        userId: "user_1",
        userAccessToken: "secret-user-token",
        scopes: [],
        expiresAtMs: Date.parse("2026-07-22T12:00:00.000Z"),
      },
      key,
    );
    expect(() =>
      readFacebookOAuthSession({
        sealed,
        key,
        now: new Date("2026-07-22T12:01:00.000Z"),
      }),
    ).toThrow("FACEBOOK_OAUTH_SESSION_EXPIRED");
  });
});
