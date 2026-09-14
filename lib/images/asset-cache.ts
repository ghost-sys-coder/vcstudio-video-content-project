/**
 * How long a browser may reuse the redirect that points at a stored asset.
 *
 * The asset routes do not serve bytes. Each request authenticates the caller,
 * resolves the generation, signs a short-lived storage URL and redirects to it,
 * so every view of a picture costs several sequential round trips before the
 * first byte moves. Marked `no-store`, that whole sequence repeated every time
 * a component remounted — switching scenes and back, opening a dialog, resizing
 * into a different layout — which is exactly when a slow connection gives up.
 *
 * **The window must expire before the signature does.** A redirect reused after
 * its signed URL has lapsed sends the browser to a refusal, which looks to the
 * creator like a broken image rather than an expired one. Half the signature's
 * life is the rule: whatever is served from cache still has at least half its
 * validity left, which is the part a slow download actually needs.
 *
 * **It is capped as well as halved.** A long signature would otherwise license
 * a long private cache, and an asset that has since been deleted would keep
 * resolving for that whole window. The signed URL grants the same access
 * anyway, so the cap is about how long a stale *reference* survives, not about
 * secrecy.
 *
 * `private` is not decoration. These URLs are specific to one viewer's
 * authorization, and a shared cache holding one would hand it to somebody else.
 */

const MAXIMUM_CACHE_SECONDS = 600;

export function assetRedirectCacheSeconds(
  signedUrlExpirySeconds: number,
): number {
  if (!Number.isFinite(signedUrlExpirySeconds) || signedUrlExpirySeconds <= 0)
    return 0;
  return Math.min(
    Math.floor(signedUrlExpirySeconds / 2),
    MAXIMUM_CACHE_SECONDS,
  );
}

export function assetRedirectCacheControl(
  signedUrlExpirySeconds: number,
): string {
  const seconds = assetRedirectCacheSeconds(signedUrlExpirySeconds);
  // Nothing worth caching, so say so rather than emitting `max-age=0`, which
  // some intermediaries treat as merely stale instead of unusable.
  return seconds <= 0 ? "private, no-store" : `private, max-age=${seconds}`;
}
