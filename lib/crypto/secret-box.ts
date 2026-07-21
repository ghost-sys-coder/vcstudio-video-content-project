import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * Authenticated symmetric encryption for secrets held at rest in PostgreSQL —
 * currently platform OAuth access/refresh tokens.
 *
 * AES-256-GCM with a random 96-bit IV per message. The sealed value is
 * `v1.<iv>.<authTag>.<ciphertext>` (base64url segments); the version prefix
 * exists so a future key rotation or algorithm change can be detected rather
 * than silently mis-decrypting.
 *
 * A refresh token is a long-lived credential that can act as the user until
 * revoked, so it must never be stored in plaintext.
 */

const VERSION = "v1";
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretBoxError";
  }
}

/**
 * Decode a 32-byte key from base64 or hex. Exported so environment validation
 * can reject a malformed key at startup instead of at first use.
 */
export function decodeEncryptionKey(value: string): Buffer {
  const trimmed = value.trim();
  if (trimmed === "") throw new SecretBoxError("Encryption key is empty.");

  const candidates: Buffer[] = [];
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === 64)
    candidates.push(Buffer.from(trimmed, "hex"));
  candidates.push(Buffer.from(trimmed, "base64"));

  const key = candidates.find(
    (candidate) => candidate.length === KEY_LENGTH_BYTES,
  );
  if (!key)
    throw new SecretBoxError(
      "Encryption key must decode to 32 bytes (base64 or hex).",
    );
  return key;
}

export function sealSecret(input: { plaintext: string; key: string }): string {
  const key = decodeEncryptionKey(input.key);
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(input.plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function openSecret(input: { sealed: string; key: string }): string {
  const key = decodeEncryptionKey(input.key);
  const segments = input.sealed.split(".");
  if (segments.length !== 4)
    throw new SecretBoxError("Sealed secret is malformed.");
  const [version, ivSegment, authTagSegment, ciphertextSegment] = segments;
  if (version !== VERSION)
    throw new SecretBoxError(`Unsupported sealed secret version: ${version}`);

  const iv = Buffer.from(ivSegment ?? "", "base64url");
  const authTag = Buffer.from(authTagSegment ?? "", "base64url");
  const ciphertext = Buffer.from(ciphertextSegment ?? "", "base64url");
  if (iv.length !== IV_LENGTH_BYTES)
    throw new SecretBoxError("Sealed secret has an invalid IV.");
  if (authTag.length !== AUTH_TAG_LENGTH_BYTES)
    throw new SecretBoxError("Sealed secret has an invalid auth tag.");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  try {
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Wrong key or tampered payload — never leak which.
    throw new SecretBoxError("Sealed secret could not be decrypted.");
  }
}

/**
 * Constant-time comparison for short opaque values (OAuth state nonces), so a
 * comparison cannot be used as a timing oracle.
 */
export function safeEquals(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}
