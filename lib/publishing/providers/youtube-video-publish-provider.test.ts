import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { YouTubeVideoPublishProvider } from "@/lib/publishing/providers/youtube-video-publish-provider";

describe("YouTube authorization", () => {
  it("requires consent and account selection for additional channels", () => {
    const provider = new YouTubeVideoPublishProvider({
      clientId: "client-id",
      clientSecret: "client-secret",
    });
    const authorizationUrl = new URL(
      provider.createAuthorizationUrl({
        redirectUri: "https://studio.example.com/api/youtube/callback",
        state: "signed-state",
      }),
    );

    expect(authorizationUrl.searchParams.get("prompt")).toBe(
      "consent select_account",
    );
    expect(authorizationUrl.searchParams.get("access_type")).toBe("offline");
    expect(authorizationUrl.searchParams.get("state")).toBe("signed-state");
  });
});
