import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { FacebookVideoPublishProvider } from "@/lib/publishing/providers/facebook-video-publish-provider";

describe("Facebook video publishing provider", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("requests only the Page permissions required for publishing", () => {
    const provider = new FacebookVideoPublishProvider({
      apiVersion: "v25.0",
      appId: "app-id",
      appSecret: "app-secret",
    });
    const url = new URL(
      provider.createAuthorizationUrl({
        redirectUri: "https://studio.example.com/api/facebook/callback",
        state: "signed-state",
      }),
    );
    expect(url.pathname).toBe("/v25.0/dialog/oauth");
    expect(url.searchParams.get("scope")?.split(",")).toEqual([
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
    ]);
    expect(url.searchParams.get("state")).toBe("signed-state");
  });

  it("discovers manageable Pages without exposing the user token", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "42",
              name: "Studio Page",
              access_token: "page-token",
              tasks: ["CREATE_CONTENT"],
            },
          ],
        }),
        { status: 200 },
      ),
    );
    const provider = new FacebookVideoPublishProvider({ apiVersion: "v25.0" });
    await expect(provider.listPages("user-token")).resolves.toEqual([
      {
        externalAccountId: "42",
        externalAccountName: "Studio Page",
        externalAccountUrl: "https://www.facebook.com/42",
        pageAccessToken: "page-token",
        tasks: ["CREATE_CONTENT"],
      },
    ]);
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({
      headers: { Authorization: "Bearer user-token" },
    });
  });

  it("publishes a public Page video through a resumable session", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            upload_session_id: "session-1",
            video_id: "video-1",
            start_offset: "0",
            end_offset: "4",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3, 4]), { status: 206 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ start_offset: "4", end_offset: "4" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    const provider = new FacebookVideoPublishProvider({ apiVersion: "v25.0" });
    await expect(
      provider.publishVideo({
        tokens: { accessToken: "page-token" },
        account: { externalAccountId: "page-42" },
        sourceUrl: "https://assets.example.com/video.mp4",
        sizeBytes: 4,
        contentType: "video/mp4",
        title: "Test video",
        description: "Description",
        tags: [],
        visibility: "public",
        caption: null,
        shareToFeed: null,
        providerOperationId: null,
      }),
    ).resolves.toEqual({
      externalVideoId: "video-1",
      externalVideoUrl: "https://www.facebook.com/page-42/videos/video-1",
      uploadedBytes: 4,
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/page-42/videos");
    expect(fetchMock.mock.calls[3]?.[1]?.body?.toString()).toContain(
      "published=true",
    );
  });
});
