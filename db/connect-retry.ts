/**
 * Error codes that prove the request never reached the database.
 *
 * This list is the whole safety argument for retrying. Each of these means the
 * TCP/TLS connection was never established, so no bytes were delivered and the
 * query cannot have executed — which makes a retry safe even for an `insert`.
 *
 * `ECONNRESET` is deliberately **absent**. A reset can arrive after the request
 * was written, so the statement may have run; retrying it could double-execute
 * a write. An ambiguous failure must surface as an error, not be quietly
 * repeated.
 */
const NEVER_SENT_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

export const DEFAULT_CONNECT_ATTEMPTS = 3;
export const DEFAULT_CONNECT_BACKOFF_MS = 150;

function errorCodes(error: unknown): string[] {
  const codes: string[] = [];
  let current: unknown = error;
  // undici nests the real reason two or three levels down: the thrown
  // TypeError's `cause` is a NeonDbError or ConnectTimeoutError, whose own
  // `cause` carries the code.
  for (
    let depth = 0;
    depth < 5 && current !== null && current !== undefined;
    depth += 1
  ) {
    if (typeof current !== "object") break;
    const record = current as { code?: unknown; cause?: unknown };
    if (typeof record.code === "string") codes.push(record.code);
    current = record.cause;
  }
  return codes;
}

/** Whether a thrown fetch error proves the request was never delivered. */
export function isNeverSentError(error: unknown): boolean {
  return errorCodes(error).some((code) => NEVER_SENT_CODES.has(code));
}

export function backoffDelayMs(attempt: number, baseMs: number): number {
  // Exponential with jitter. The jitter matters more than the growth here: the
  // failure this exists for is several concurrent connections opening at once,
  // and retrying them all on the same schedule would just recreate the burst.
  const exponential = baseMs * 2 ** (attempt - 1);
  return Math.round(exponential * (0.5 + Math.random()));
}

/**
 * Wraps a `fetch` so connection failures are retried.
 *
 * Exists because the Neon HTTP driver opens a fresh connection per query, and a
 * page that issues several queries concurrently opens several at once. On
 * networks that throttle simultaneous outbound TLS handshakes — observed
 * locally at roughly a 40% failure rate at concurrency 3+, while sequential
 * queries never failed — the surplus connections time out after 10s and
 * surface as `DrizzleQueryError: Failed query`, naming whichever query happened
 * to be in flight rather than the connection that actually failed.
 *
 * Only failures proven not to have reached the server are retried; anything the
 * database actually answered, including an error response, is returned
 * untouched.
 */
export function createRetryingFetch(options?: {
  fetchImplementation?: typeof fetch;
  attempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): typeof fetch {
  const fetchImplementation = options?.fetchImplementation ?? fetch;
  const attempts = options?.attempts ?? DEFAULT_CONNECT_ATTEMPTS;
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_CONNECT_BACKOFF_MS;
  const sleep =
    options?.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  return async function retryingFetch(
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await fetchImplementation(input, init);
      } catch (error) {
        lastError = error;
        if (!isNeverSentError(error) || attempt === attempts) throw error;
        await sleep(backoffDelayMs(attempt, baseDelayMs));
      }
    }
    throw lastError;
  } as typeof fetch;
}
