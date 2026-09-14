import { describe, expect, it } from "vitest";
import {
  imageRetryDelayMilliseconds,
  MAXIMUM_AUTOMATIC_IMAGE_ATTEMPTS,
  shouldRetryImage,
  withImageRetryAttempt,
} from "@/lib/images/image-retry";

describe("shouldRetryImage", () => {
  it("retries a first failure", () => {
    expect(shouldRetryImage(0)).toBe(true);
  });

  // An image that is genuinely gone would otherwise be requested forever, and
  // every request costs authentication, two lookups and a signature.
  it("stops once the automatic attempts are spent", () => {
    expect(shouldRetryImage(MAXIMUM_AUTOMATIC_IMAGE_ATTEMPTS)).toBe(false);
    expect(shouldRetryImage(MAXIMUM_AUTOMATIC_IMAGE_ATTEMPTS + 5)).toBe(false);
  });
});

describe("imageRetryDelayMilliseconds", () => {
  it("waits longer after each failure", () => {
    expect(imageRetryDelayMilliseconds(1)).toBeGreaterThan(
      imageRetryDelayMilliseconds(0),
    );
    expect(imageRetryDelayMilliseconds(2)).toBeGreaterThan(
      imageRetryDelayMilliseconds(1),
    );
  });

  it("never waits so long that the creator has moved on", () => {
    expect(imageRetryDelayMilliseconds(40)).toBeLessThanOrEqual(8_000);
  });

  it("retries the first failure promptly", () => {
    expect(imageRetryDelayMilliseconds(0)).toBeLessThanOrEqual(1_000);
  });

  it("never returns a negative delay for a nonsense attempt", () => {
    expect(imageRetryDelayMilliseconds(-3)).toBeGreaterThan(0);
  });
});

describe("withImageRetryAttempt", () => {
  // The first load must share a cache entry with every other view of the same
  // image, or opening a scene twice fetches it twice.
  it("leaves the first attempt untouched", () => {
    expect(withImageRetryAttempt("/api/a/asset", 0)).toBe("/api/a/asset");
  });

  it("marks a retry so the browser cannot serve the cached failure", () => {
    expect(withImageRetryAttempt("/api/a/asset", 2)).toBe(
      "/api/a/asset?retry=2",
    );
  });

  it("appends to a URL that already carries parameters", () => {
    expect(withImageRetryAttempt("/api/a/asset?size=1024", 1)).toBe(
      "/api/a/asset?size=1024&retry=1",
    );
  });

  it("keeps the fragment at the end where it belongs", () => {
    expect(withImageRetryAttempt("/api/a/asset#top", 1)).toBe(
      "/api/a/asset?retry=1#top",
    );
    expect(withImageRetryAttempt("/api/a/asset?x=1#top", 1)).toBe(
      "/api/a/asset?x=1&retry=1#top",
    );
  });

  it("gives each attempt its own URL, so no two retries collide", () => {
    const attempts = [1, 2, 3].map((attempt) =>
      withImageRetryAttempt("/api/a/asset", attempt),
    );
    expect(new Set(attempts).size).toBe(3);
  });

  it("leaves an empty source alone rather than inventing a request", () => {
    expect(withImageRetryAttempt("", 2)).toBe("");
  });
});
