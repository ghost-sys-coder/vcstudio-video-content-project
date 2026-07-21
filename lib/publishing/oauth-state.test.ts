import { describe, expect, it } from "vitest";
import {
  createOAuthState,
  OAuthStateError,
  verifyOAuthState,
} from "@/lib/publishing/oauth-state";

const secret = "s".repeat(48);
const base = {
  workspaceId: "workspace-1",
  userId: "user-1",
  platform: "youtube",
};
const verifyBase = { secret, ttlSeconds: 600, platform: "youtube" };

describe("OAuth state", () => {
  it("round-trips the workspace and user it was minted for", () => {
    const payload = verifyOAuthState({
      state: createOAuthState({ ...base, secret }),
      ...verifyBase,
    });
    expect(payload.workspaceId).toBe("workspace-1");
    expect(payload.userId).toBe("user-1");
  });

  it("is unguessable across calls (fresh nonce)", () => {
    expect(createOAuthState({ ...base, secret })).not.toBe(
      createOAuthState({ ...base, secret }),
    );
  });

  it("rejects a state signed with a different secret", () => {
    const forged = createOAuthState({ ...base, secret: "x".repeat(48) });
    expect(() => verifyOAuthState({ state: forged, ...verifyBase })).toThrow(
      OAuthStateError,
    );
  });

  it("rejects a tampered payload — the core CSRF defense", () => {
    const state = createOAuthState({ ...base, secret });
    const [version, encoded, signature] = state.split(".");
    const hijacked = Buffer.from(
      JSON.stringify({
        workspaceId: "attacker-workspace",
        userId: "attacker",
        platform: "youtube",
        nonce: "n",
        issuedAtMs: Date.now(),
      }),
      "utf8",
    ).toString("base64url");
    expect(() =>
      verifyOAuthState({
        state: [version, hijacked, signature].join("."),
        ...verifyBase,
      }),
    ).toThrow(OAuthStateError);
    expect(encoded).not.toBe(hijacked);
  });

  it("rejects an expired state", () => {
    const state = createOAuthState({
      ...base,
      secret,
      now: new Date(Date.now() - 601_000),
    });
    expect(() => verifyOAuthState({ state, ...verifyBase })).toThrow(
      OAuthStateError,
    );
  });

  it("rejects a state issued in the future", () => {
    const state = createOAuthState({
      ...base,
      secret,
      now: new Date(Date.now() + 60_000),
    });
    expect(() => verifyOAuthState({ state, ...verifyBase })).toThrow(
      OAuthStateError,
    );
  });

  it("rejects replay at a different platform's callback", () => {
    const state = createOAuthState({ ...base, secret });
    expect(() =>
      verifyOAuthState({ state, ...verifyBase, platform: "facebook" }),
    ).toThrow(OAuthStateError);
  });

  it("rejects malformed and wrong-version states", () => {
    for (const state of ["", "garbage", "s1.only-two", "s2.a.b"])
      expect(() => verifyOAuthState({ state, ...verifyBase })).toThrow(
        OAuthStateError,
      );
  });
});
