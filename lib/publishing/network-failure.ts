/**
 * Whether a thrown `fetch` provably never reached the provider.
 *
 * `fetch` rejects for two very different reasons, and treating them alike is
 * expensive in both directions. If the connection was never established — DNS
 * did not resolve, the port refused, the TCP connect timed out — then nothing
 * was sent, so the request cannot have published anything and is safe to retry.
 * If the socket died *after* the request went out, the provider may well have
 * acted on it, and retrying risks posting twice.
 *
 * Only the connect-phase codes are listed. `ECONNRESET`, `ETIMEDOUT`, and
 * undici's generic `UND_ERR_SOCKET` are deliberately excluded: they can occur
 * after the bytes are on the wire, so they stay ambiguous. The bias is toward
 * calling something ambiguous, because a duplicate post on a real account is
 * worse than a publication that needs retrying by hand.
 *
 * Node nests the real cause one level down (`TypeError: fetch failed` with a
 * `cause`), so both levels are inspected.
 */
const NEVER_CONNECTED_CODES = new Set([
  // DNS could not resolve the host.
  "ENOTFOUND",
  "EAI_AGAIN",
  // Host resolved but actively refused the connection.
  "ECONNREFUSED",
  // TCP connect timed out — undici reports the connect phase distinctly from a
  // socket that died mid-request, which is what makes this safe to treat as
  // "never sent".
  "UND_ERR_CONNECT_TIMEOUT",
  // No route / network down.
  "ENETUNREACH",
  "EHOSTUNREACH",
]);

function codeOf(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const code = (value as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export function isNeverSentNetworkError(error: unknown): boolean {
  const direct = codeOf(error);
  if (direct && NEVER_CONNECTED_CODES.has(direct)) return true;
  const cause =
    typeof error === "object" && error !== null
      ? (error as { cause?: unknown }).cause
      : null;
  const nested = codeOf(cause);
  return nested !== null && NEVER_CONNECTED_CODES.has(nested);
}
