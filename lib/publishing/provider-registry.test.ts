import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  isPublishablePlatform,
  PUBLISHABLE_PLATFORMS,
} from "@/lib/publishing/provider-registry";

describe("publishable platform gating", () => {
  it("allows implemented publishing platforms", () => {
    expect(isPublishablePlatform("youtube")).toBe(true);
    expect(isPublishablePlatform("facebook")).toBe(true);
    expect(isPublishablePlatform("instagram")).toBe(true);
    expect(PUBLISHABLE_PLATFORMS).toContain("youtube");
    expect(PUBLISHABLE_PLATFORMS).toContain("facebook");
    expect(PUBLISHABLE_PLATFORMS).toContain("instagram");
  });

  it("blocks platforms whose integration does not exist yet", () => {
    // These are valid content_platform values (briefs/titles/thumbnails support
    // them), so the registry — not the enum — must gate publishing.
    expect(isPublishablePlatform("tiktok")).toBe(false);
  });
});
