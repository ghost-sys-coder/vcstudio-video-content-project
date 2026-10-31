import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  createLinkedInPagesSession,
  readLinkedInPagesSession,
} from "./linkedin-pages-session";
import { sealSecret } from "@/lib/crypto/secret-box";

const key = Buffer.alloc(32, 7).toString("base64");
const input = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  userId: "actor",
  ttlSeconds: 3600,
  tokens: {
    accessToken: "secret-token",
    refreshToken: "secret-refresh",
    expiresAt: null,
    scopes: ["rw_organization_admin", "w_organization_social"],
  },
};
describe("encrypted, expiring Page selection", () => {
  it("round trips tokens in ciphertext and caps selection at ten minutes", () => {
    const before = Date.now();
    const sealed = createLinkedInPagesSession(input, key);
    expect(sealed).not.toContain("secret-token");
    const result = readLinkedInPagesSession({ sealed, key });
    expect(result.workspaceId).toBe(input.workspaceId);
    expect(result.refreshToken).toBe("secret-refresh");
    expect(result.expiresAtMs).toBeLessThanOrEqual(before + 600_010);
    expect(() =>
      readLinkedInPagesSession({
        sealed,
        key,
        now: new Date(result.expiresAtMs),
      }),
    ).toThrow();
  });
  it("expires no later than the access token", () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const sealed = createLinkedInPagesSession(
      { ...input, tokens: { ...input.tokens, expiresAt } },
      key,
    );
    expect(readLinkedInPagesSession({ sealed, key }).expiresAtMs).toBe(
      expiresAt.getTime(),
    );
  });
  it("rejects tampering and another subsystem's session", () => {
    const sealed = createLinkedInPagesSession(input, key);
    expect(() =>
      readLinkedInPagesSession({ sealed: sealed.slice(0, -3) + "aaa", key }),
    ).toThrow();
    const other = sealSecret({
      plaintext: JSON.stringify({
        ...input,
        purpose: "facebook",
        expiresAtMs: Date.now() + 60_000,
      }),
      key,
    });
    expect(() => readLinkedInPagesSession({ sealed: other, key })).toThrow();
  });
  it("rejects profile grants and oversized cookies", () => {
    expect(() =>
      createLinkedInPagesSession(
        { ...input, tokens: { ...input.tokens, scopes: ["w_member_social"] } },
        key,
      ),
    ).toThrow();
    expect(() =>
      createLinkedInPagesSession(
        {
          ...input,
          tokens: {
            ...input.tokens,
            accessToken: "a".repeat(2000),
            refreshToken: "r".repeat(2000),
          },
        },
        key,
      ),
    ).toThrow();
  });
});
