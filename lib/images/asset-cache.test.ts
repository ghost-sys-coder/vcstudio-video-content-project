import { describe, expect, it } from "vitest";
import {
  assetRedirectCacheControl,
  assetRedirectCacheSeconds,
} from "@/lib/images/asset-cache";

describe("assetRedirectCacheSeconds", () => {
  // The invariant the whole thing rests on: anything served from cache must
  // still have signature life left, or the creator sees a broken picture
  // instead of an expired link.
  it.each([60, 120, 300, 900, 3600])(
    "always expires well before a %i second signature",
    (expiry) => {
      expect(assetRedirectCacheSeconds(expiry)).toBeLessThan(expiry);
    },
  );

  it("leaves at least half the signature for the download itself", () => {
    expect(assetRedirectCacheSeconds(300)).toBeLessThanOrEqual(150);
  });

  it("caps the window so a deleted asset stops resolving promptly", () => {
    expect(assetRedirectCacheSeconds(3600)).toBeLessThanOrEqual(600);
  });

  it("caches nothing for a nonsensical expiry rather than guessing", () => {
    expect(assetRedirectCacheSeconds(0)).toBe(0);
    expect(assetRedirectCacheSeconds(-30)).toBe(0);
    expect(assetRedirectCacheSeconds(Number.NaN)).toBe(0);
  });

  it("returns whole seconds, since a header cannot carry a fraction", () => {
    expect(Number.isInteger(assetRedirectCacheSeconds(301))).toBe(true);
  });
});

describe("assetRedirectCacheControl", () => {
  // A shared cache holding one of these would serve one viewer's authorized
  // URL to another.
  it("is never cacheable by anything but the viewer's own browser", () => {
    for (const expiry of [0, 60, 300, 3600])
      expect(assetRedirectCacheControl(expiry)).toContain("private");
  });

  it("allows reuse for a sane expiry", () => {
    expect(assetRedirectCacheControl(300)).toBe("private, max-age=150");
  });

  it("refuses storage outright when there is nothing safe to cache", () => {
    expect(assetRedirectCacheControl(0)).toBe("private, no-store");
  });
});
