import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decodeEncryptionKey,
  openSecret,
  safeEquals,
  sealSecret,
  SecretBoxError,
} from "@/lib/crypto/secret-box";

const key = randomBytes(32).toString("base64");
const otherKey = randomBytes(32).toString("base64");

describe("decodeEncryptionKey", () => {
  it("accepts 32-byte base64 and hex keys", () => {
    expect(decodeEncryptionKey(key)).toHaveLength(32);
    expect(decodeEncryptionKey(randomBytes(32).toString("hex"))).toHaveLength(
      32,
    );
  });

  it("rejects an empty or wrong-length key", () => {
    expect(() => decodeEncryptionKey("")).toThrow(SecretBoxError);
    expect(() =>
      decodeEncryptionKey(randomBytes(16).toString("base64")),
    ).toThrow(SecretBoxError);
  });
});

describe("sealSecret / openSecret", () => {
  it("round-trips a token", () => {
    const plaintext = "1//0abcDEF-refresh-token_value";
    expect(openSecret({ sealed: sealSecret({ plaintext, key }), key })).toBe(
      plaintext,
    );
  });

  it("round-trips unicode and empty strings", () => {
    for (const plaintext of ["", "héllo 🌍 tokén"])
      expect(openSecret({ sealed: sealSecret({ plaintext, key }), key })).toBe(
        plaintext,
      );
  });

  it("never emits the plaintext in the sealed value", () => {
    const plaintext = "super-secret-refresh-token";
    const sealed = sealSecret({ plaintext, key });
    expect(sealed).not.toContain(plaintext);
    expect(sealed.startsWith("v1.")).toBe(true);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const plaintext = "same-token";
    expect(sealSecret({ plaintext, key })).not.toBe(
      sealSecret({ plaintext, key }),
    );
  });

  it("refuses to decrypt with the wrong key", () => {
    const sealed = sealSecret({ plaintext: "token", key });
    expect(() => openSecret({ sealed, key: otherKey })).toThrow(SecretBoxError);
  });

  it("refuses a tampered ciphertext, IV, or auth tag", () => {
    const sealed = sealSecret({ plaintext: "token", key });
    const [version, iv, authTag, ciphertext] = sealed.split(".");
    const flip = (value: string) =>
      value.slice(0, -2) + (value.at(-2) === "A" ? "B" : "A") + value.at(-1);
    for (const tampered of [
      [version, iv, authTag, flip(ciphertext ?? "")].join("."),
      [version, flip(iv ?? ""), authTag, ciphertext].join("."),
      [version, iv, flip(authTag ?? ""), ciphertext].join("."),
    ])
      expect(() => openSecret({ sealed: tampered, key })).toThrow(
        SecretBoxError,
      );
  });

  it("rejects a malformed or unknown-version payload", () => {
    expect(() => openSecret({ sealed: "not-sealed", key })).toThrow(
      SecretBoxError,
    );
    const sealed = sealSecret({ plaintext: "token", key });
    expect(() =>
      openSecret({ sealed: `v2.${sealed.split(".").slice(1).join(".")}`, key }),
    ).toThrow(SecretBoxError);
  });
});

describe("safeEquals", () => {
  it("compares equal and unequal values", () => {
    expect(safeEquals("abc123", "abc123")).toBe(true);
    expect(safeEquals("abc123", "abc124")).toBe(false);
    expect(safeEquals("abc", "abcdef")).toBe(false);
    expect(safeEquals("", "")).toBe(true);
  });
});
