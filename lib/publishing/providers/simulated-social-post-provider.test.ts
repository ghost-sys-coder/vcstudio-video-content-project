import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { SimulatedSocialPostProvider } from "@/lib/publishing/providers/simulated-social-post-provider";
import type { PublishPostRequest } from "@/lib/publishing/social-post-provider";

function request(
  overrides: Partial<PublishPostRequest> = {},
): PublishPostRequest {
  return {
    tokens: { accessToken: "token" },
    account: { externalAccountId: "account-1" },
    text: "Hello",
    media: [],
    providerOperationId: null,
    providerOperationSecret: null,
    ...overrides,
  };
}

describe("SimulatedSocialPostProvider", () => {
  it("reports monotonic progress ending at 100", async () => {
    const seen: number[] = [];
    const provider = new SimulatedSocialPostProvider({
      platform: "linkedin",
      stepDelayMs: 0,
    });
    await provider.publishPost(
      request({ onProgress: (percent) => void seen.push(percent) }),
    );
    expect(seen.at(-1)).toBe(100);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it("returns an obviously synthetic identifier and a non-resolving URL", async () => {
    const provider = new SimulatedSocialPostProvider({
      platform: "facebook",
      stepDelayMs: 0,
    });
    const result = await provider.publishPost(request());
    // "SIM" and `.invalid` both exist so a simulated result can never be
    // mistaken for a real published post in the UI or in support.
    expect(result.externalPostId.startsWith("SIM-")).toBe(true);
    expect(result.externalPostUrl).toContain("example.invalid");
  });

  it("keeps TikTok's inbox semantics rather than claiming a publication", async () => {
    const provider = new SimulatedSocialPostProvider({
      platform: "tiktok",
      stepDelayMs: 0,
    });
    expect((await provider.publishPost(request())).completionStage).toBe(
      "inbox_delivered",
    );
  });

  it("reports a normal publication for every other platform", async () => {
    for (const platform of [
      "linkedin",
      "facebook",
      "instagram",
      "youtube",
    ] as const) {
      const provider = new SimulatedSocialPostProvider({
        platform,
        stepDelayMs: 0,
      });
      expect((await provider.publishPost(request())).completionStage).toBe(
        "published",
      );
    }
  });
});
