import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isPublishablePlatform,
  PUBLISHABLE_PLATFORMS,
} from "@/lib/publishing/provider-registry";

describe("publishable platform gating", () => {
  it("allows YouTube today", () => {
    expect(isPublishablePlatform("youtube")).toBe(true);
    expect(PUBLISHABLE_PLATFORMS).toContain("youtube");
  });

  it("blocks platforms whose integration does not exist yet", () => {
    // These are valid content_platform values (briefs/titles/thumbnails support
    // them), so the registry — not the enum — must gate publishing.
    for (const platform of ["facebook", "instagram", "tiktok"] as const)
      expect(isPublishablePlatform(platform)).toBe(false);
  });
});
