import { createHmac, randomBytes } from "node:crypto";
import { safeEquals } from "@/lib/crypto/secret-box";

/**
 * Signed, expiring OAuth `state`.
 *
 * The callback is an unauthenticated entry point that a third party can invoke,
 * so state must prove three things: the flow started here (HMAC), it is recent
 * (issuedAt + TTL), and it belongs to a specific workspace (payload). Without
 * this, an attacker could complete a flow and graft their own channel onto
 * someone else's workspace.
 */

const VERSION = "s1";

export type OAuthStatePayload = {
  workspaceId: string;
  userId: string;
  platform: string;
  nonce: string;
  issuedAtMs: number;
};

export class OAuthStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthStateError";
  }
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${VERSION}.${encodedPayload}`)
    .digest("base64url");
}

export function createOAuthState(input: {
  workspaceId: string;
  userId: string;
  platform: string;
  secret: string;
  now?: Date;
}): string {
  const payload: OAuthStatePayload = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    platform: input.platform,
    nonce: randomBytes(16).toString("base64url"),
    issuedAtMs: (input.now ?? new Date()).getTime(),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${VERSION}.${encoded}.${sign(encoded, input.secret)}`;
}

export function verifyOAuthState(input: {
  state: string;
  secret: string;
  ttlSeconds: number;
  platform: string;
  now?: Date;
}): OAuthStatePayload {
  const segments = input.state.split(".");
  if (segments.length !== 3 || segments[0] !== VERSION)
    throw new OAuthStateError("The authorization state is malformed.");
  const [, encoded, signature] = segments;

  // Verify before parsing, so untrusted bytes are never JSON-decoded.
  if (!safeEquals(signature ?? "", sign(encoded ?? "", input.secret)))
    throw new OAuthStateError("The authorization state failed verification.");

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(encoded ?? "", "base64url").toString("utf8"),
    ) as OAuthStatePayload;
  } catch {
    throw new OAuthStateError("The authorization state is unreadable.");
  }

  if (
    typeof payload.workspaceId !== "string" ||
    typeof payload.userId !== "string" ||
    typeof payload.platform !== "string" ||
    typeof payload.issuedAtMs !== "number"
  )
    throw new OAuthStateError("The authorization state is incomplete.");

  // A state minted for one platform must not be replayed at another's callback.
  if (payload.platform !== input.platform)
    throw new OAuthStateError(
      "The authorization state is for another platform.",
    );

  const ageMs = (input.now ?? new Date()).getTime() - payload.issuedAtMs;
  if (ageMs < 0 || ageMs > input.ttlSeconds * 1000)
    throw new OAuthStateError("The authorization request expired. Try again.");

  return payload;
}
