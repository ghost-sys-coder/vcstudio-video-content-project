import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Controllable publishing environment for the config-gating tests.
const publishingEnv: Record<string, unknown> = {};
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => publishingEnv,
  getPublishingWebEnvironment: () => ({
    APP_BASE_URL: "https://example.com",
    OAUTH_STATE_SECRET: "s".repeat(48),
    OAUTH_STATE_TTL_SECONDS: 600,
  }),
}));

import {
  createVideoPublishProvider,
  isPlatformConfigured,
  isPublishablePlatform,
  PlatformNotConfiguredError,
  PUBLISHABLE_PLATFORMS,
} from "@/lib/publishing/provider-registry";

function setEnv(overrides: Record<string, unknown>) {
  for (const key of Object.keys(publishingEnv)) delete publishingEnv[key];
  Object.assign(
    publishingEnv,
    {
      ENABLE_PUBLISH_SIMULATION: false,
      PUBLISH_SIMULATION_STEP_MS: 0,
      FACEBOOK_GRAPH_API_VERSION: "v25.0",
      INSTAGRAM_GRAPH_API_VERSION: "v25.0",
    },
    overrides,
  );
}

describe("publishable platform gating", () => {
  it("allows implemented publishing platforms", () => {
    for (const platform of [
      "youtube",
      "facebook",
      "instagram",
      "tiktok",
    ] as const) {
      expect(isPublishablePlatform(platform)).toBe(true);
      expect(PUBLISHABLE_PLATFORMS).toContain(platform);
    }
  });
});

describe("per-platform credential configuration", () => {
  beforeEach(() => setEnv({}));

  it("reports YouTube configured only when both Google creds are present", () => {
    setEnv({ GOOGLE_OAUTH_CLIENT_ID: "id", GOOGLE_OAUTH_CLIENT_SECRET: "sec" });
    expect(isPlatformConfigured("youtube")).toBe(true);
    setEnv({ GOOGLE_OAUTH_CLIENT_ID: "id" });
    expect(isPlatformConfigured("youtube")).toBe(false);
    setEnv({});
    expect(isPlatformConfigured("youtube")).toBe(false);
  });

  it("treats a blank credential as not configured", () => {
    setEnv({ TIKTOK_API_CLIENT_KEY: "   ", TIKTOK_API_CLIENT_SECRET: "x" });
    expect(isPlatformConfigured("tiktok")).toBe(false);
  });

  it("treats Facebook/Instagram as always configured (no app secret needed)", () => {
    setEnv({});
    expect(isPlatformConfigured("facebook")).toBe(true);
    expect(isPlatformConfigured("instagram")).toBe(true);
  });

  it("a missing TikTok credential does NOT affect YouTube — the outage's core fix", () => {
    // Google present, TikTok absent: YouTube stays publishable.
    setEnv({ GOOGLE_OAUTH_CLIENT_ID: "id", GOOGLE_OAUTH_CLIENT_SECRET: "sec" });
    expect(isPlatformConfigured("youtube")).toBe(true);
    expect(isPlatformConfigured("tiktok")).toBe(false);
    // And constructing a YouTube provider succeeds despite TikTok being unset.
    expect(() => createVideoPublishProvider("youtube")).not.toThrow();
  });

  it("throws PlatformNotConfiguredError when constructing an unconfigured platform", () => {
    setEnv({});
    expect(() => createVideoPublishProvider("tiktok")).toThrow(
      PlatformNotConfiguredError,
    );
    try {
      createVideoPublishProvider("youtube");
    } catch (error) {
      expect(error).toBeInstanceOf(PlatformNotConfiguredError);
      expect((error as PlatformNotConfiguredError).platform).toBe("youtube");
      // Message is user-safe and names no secret value.
      expect((error as Error).message).toContain("YouTube");
    }
  });

  it("constructs the real provider once its credentials are present", () => {
    setEnv({
      TIKTOK_API_CLIENT_KEY: "key",
      TIKTOK_API_CLIENT_SECRET: "secret",
    });
    const provider = createVideoPublishProvider("tiktok");
    expect(provider.platform).toBe("tiktok");
  });

  it("in simulation mode every platform is configured and needs no credentials", () => {
    setEnv({ ENABLE_PUBLISH_SIMULATION: true });
    for (const platform of [
      "youtube",
      "facebook",
      "instagram",
      "tiktok",
    ] as const) {
      expect(isPlatformConfigured(platform)).toBe(true);
      expect(() => createVideoPublishProvider(platform)).not.toThrow();
    }
  });
});
