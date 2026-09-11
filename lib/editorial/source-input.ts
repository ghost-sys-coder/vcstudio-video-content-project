/**
 * Accepting source material as untrusted input.
 *
 * A source is text and a link that somebody found on the internet and pasted
 * in. `AGENTS.md` requires external input to be validated, and the version-two
 * plan is explicit that source content must never override this application's
 * instructions or its authorization. Two concrete rules follow.
 *
 * **A source is data, never an instruction.** Nothing in this slice sends a
 * source to a model, so there is no prompt for a pasted "ignore your previous
 * instructions" to land in. That is the protection: not an escaping scheme, but
 * the absence of a path. If a later slice does feed sources to a provider, it
 * must fence them as untrusted content and re-read this note first — a sanitizer
 * is not what makes injection impossible, an unreachable prompt is.
 *
 * **A link is a string until a person clicks it.** The application never
 * fetches a stored URL, so this module makes no SSRF claim it cannot keep. What
 * it does refuse is a URL that cannot function as evidence at all: a scheme
 * that executes rather than addresses (`javascript:`, `data:`), embedded
 * credentials, and hosts only the author's own machine can reach. A citation
 * nobody else can open is not a citation.
 */

/** Shown wherever sources are entered or displayed. */
export const UNTRUSTED_SOURCE_NOTICE =
  "Sources are stored as plain text and links. This app does not open them, read them, or check what they say.";

/** Generous enough for a real citation, bounded so a paste cannot be a payload. */
export const MAX_SOURCE_URL_LENGTH = 2048;
export const MAX_SOURCE_TITLE_LENGTH = 300;
export const MAX_SOURCE_NOTE_LENGTH = 4000;
export const MAX_CLAIM_QUOTE_LENGTH = 1000;
export const MAX_CLAIM_NOTE_LENGTH = 2000;

/**
 * C0 and C1 control characters other than tab and newline, plus the bidi
 * overrides.
 *
 * The bidi characters are the reason this exists rather than a plain trim.
 * U+202E and its relatives reorder rendered text without changing the stored
 * string, so a note can be made to display a different domain, a different
 * figure, or a reversed verdict from the one that was saved. A review record
 * whose screen text disagrees with its stored text is worse than no record.
 */
const UNSAFE_CHARACTERS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;

/** Strips what must not be stored, composes, collapses blank runs, and caps. */
export function sanitizeSourceText(value: string, maxLength: number): string {
  return value
    .normalize("NFC")
    .replace(UNSAFE_CHARACTERS, "")
    .replace(/\r\n?/gu, "\n")
    .replace(/[ \t]+/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim()
    .slice(0, maxLength);
}

export type SourceUrlResult =
  { ok: true; url: string; host: string } | { ok: false; message: string };

const PRIVATE_HOST =
  /^(localhost|127\.\p{Nd}+\.\p{Nd}+\.\p{Nd}+|0\.0\.0\.0|10\.\p{Nd}+\.\p{Nd}+\.\p{Nd}+|192\.168\.\p{Nd}+\.\p{Nd}+|172\.(1[6-9]|2\p{Nd}|3[01])\.\p{Nd}+\.\p{Nd}+|\[?::1\]?)$/iu;

/**
 * Validates a pasted citation link, returning the normalized form and its host.
 *
 * The host is returned separately so an interface can show where a link
 * actually goes. Displaying only a title lets a source called "Federal Reserve"
 * point anywhere.
 */
export function normalizeSourceUrl(value: string): SourceUrlResult {
  const raw = sanitizeSourceText(value, MAX_SOURCE_URL_LENGTH);
  if (raw.length === 0) return { ok: false, message: "Enter a link." };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return {
      ok: false,
      message: "That is not a complete link. Include https:// at the start.",
    };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    return {
      ok: false,
      message: `Only http and https links can be cited. ${parsed.protocol.replace(":", "")} links are not accepted.`,
    };
  if (parsed.username !== "" || parsed.password !== "")
    return {
      ok: false,
      message:
        "Remove the username and password from the link. A citation must not carry credentials.",
    };
  if (PRIVATE_HOST.test(parsed.hostname))
    return {
      ok: false,
      message:
        "That link only works on this machine or network, so nobody reviewing the script could open it.",
    };
  if (parsed.hostname === "" || !parsed.hostname.includes("."))
    return { ok: false, message: "That link has no public host name." };
  return { ok: true, url: parsed.toString(), host: parsed.hostname };
}
