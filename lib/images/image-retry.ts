/**
 * How a scene image recovers when the network drops it.
 *
 * Scene images are not served as plain files. Each one costs an authenticated
 * request that resolves the generation, signs a short-lived storage URL and
 * redirects to it, so a picture arrives only after several round trips. On a
 * slow or flaky connection any one of them can fail, and a browser that fails
 * to load an `img` does not try again — the element simply stays empty for as
 * long as the page is open. That is the whole defect: not that loading is slow,
 * but that a single transient failure is permanent.
 *
 * Retrying is therefore automatic, bounded and spaced out. Bounded because an
 * image that is genuinely missing would otherwise be requested forever, turning
 * one broken picture into a stream of authenticated requests. Spaced out
 * because the usual cause is congestion, and retrying instantly makes that
 * worse.
 */

/**
 * Attempts made without asking. Three covers the transient case — a dropped
 * connection, an expired signature, a request that timed out behind others —
 * while still giving up quickly enough that a genuinely missing image reports
 * itself rather than retrying quietly in the background.
 */
export const MAXIMUM_AUTOMATIC_IMAGE_ATTEMPTS = 3;

const BASE_DELAY_MILLISECONDS = 600;
const MAXIMUM_DELAY_MILLISECONDS = 8_000;

/** True while automatic attempts remain. `attempt` is the number already made. */
export function shouldRetryImage(attempt: number): boolean {
  return attempt < MAXIMUM_AUTOMATIC_IMAGE_ATTEMPTS;
}

/**
 * Exponential backoff, capped.
 *
 * The cap matters more than the curve: without it a fourth or fifth attempt
 * would land minutes later, long after the creator has decided the image is
 * broken and moved on.
 */
export function imageRetryDelayMilliseconds(attempt: number): number {
  const exponential = BASE_DELAY_MILLISECONDS * 2 ** Math.max(0, attempt);
  return Math.min(exponential, MAXIMUM_DELAY_MILLISECONDS);
}

/**
 * Marks a retry in the URL so the browser actually re-requests it.
 *
 * Without this the retry is pointless: a browser that has cached a failed
 * response serves the same failure back instantly, and even an uncached failure
 * may be coalesced with the request already in flight. The parameter is inert —
 * the asset route ignores unknown query parameters — so it changes which cache
 * entry is consulted and nothing else.
 *
 * The first attempt is deliberately unmarked, so the common case of an image
 * that loads first time shares a cache entry with every other view of it.
 */
export function withImageRetryAttempt(source: string, attempt: number): string {
  if (attempt <= 0 || source === "") return source;
  const fragmentAt = source.indexOf("#");
  const path = fragmentAt === -1 ? source : source.slice(0, fragmentAt);
  const fragment = fragmentAt === -1 ? "" : source.slice(fragmentAt);
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}retry=${attempt}${fragment}`;
}
