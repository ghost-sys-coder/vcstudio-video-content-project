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

  it("recovers a consented Page omitted by /me/accounts and deduplicates targets", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          data: [{ id: "42", name: "Clear Work", access_token: "clear-token" }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: {
            app_id: "app-id",
            is_valid: true,
            granular_scopes: [
              {
                scope: "pages_show_list",
                target_ids: ["42", "1025029520688408", "1025029520688408"],
              },
              { scope: "ads_management", target_ids: ["999"] },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: "1025029520688408",
          name: "VeilCode Studio",
          access_token: "veilcode-token",
        }),
      );
    const provider = new FacebookVideoPublishProvider({
      apiVersion: "v25.0",
      appId: "app-id",
      appSecret: "app-secret",
    });
    const pages = await provider.listPages("user-token");
    expect(pages.map((page) => page.externalAccountName)).toEqual([
      "Clear Work",
      "VeilCode Studio",
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe(
      "https://graph.facebook.com/v25.0/1025029520688408?fields=id%2Cname%2Caccess_token",
    );
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      headers: { Authorization: "Bearer user-token" },
      cache: "no-store",
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toContain("app-secret");
  });

  it("stops at the last page even when a cursor remains", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({
        data: [{ id: "42", name: "Studio Page", access_token: "page-token" }],
        paging: { cursors: { after: "last-cursor" } },
      }),
    );
    const provider = new FacebookVideoPublishProvider({ apiVersion: "v25.0" });
    expect(await provider.listPages("user-token")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("paginates at the fixed Graph host, deduplicates results and stops repeated cursors", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          data: [{ id: "42", name: "First", access_token: "page-token" }],
          paging: {
            next: "https://untrusted.example/steal",
            cursors: { after: "next-cursor" },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: [
            { id: "42", name: "First", access_token: "page-token" },
            { id: "43", name: "Second", access_token: "page-token" },
          ],
          paging: {
            next: "https://untrusted.example/steal",
            cursors: { after: "next-cursor" },
          },
        }),
      );
    const provider = new FacebookVideoPublishProvider({ apiVersion: "v25.0" });
    expect(await provider.listPages("user-token")).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const url = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(url.hostname).toBe("graph.facebook.com");
    expect(url.searchParams.get("after")).toBe("next-cursor");
  });

  it.each([
    {
      app_id: "another-app",
      is_valid: true,
      granular_scopes: [{ scope: "pages_show_list", target_ids: ["44"] }],
    },
    { app_id: "app-id", is_valid: false },
    { malformed: true },
  ])(
    "preserves verified Pages when grant inspection fails closed",
    async (data) => {
      const warn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          Response.json({
            data: [{ id: "42", name: "Studio", access_token: "page-token" }],
          }),
        )
        .mockResolvedValueOnce(Response.json({ data }));
      const provider = new FacebookVideoPublishProvider({
        apiVersion: "v25.0",
        appId: "app-id",
        appSecret: "app-secret",
      });
      expect(await provider.listPages("user-token")).toHaveLength(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledExactlyOnceWith(
        "Facebook Page grant discovery is unavailable.",
      );
    },
  );

  it("does not fail all discovery when one consented Page lacks a Page token", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ data: [] }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            app_id: "app-id",
            is_valid: true,
            granular_scopes: [
              { scope: "pages_show_list", target_ids: ["42", "43"] },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(Response.json({ id: "42", name: "No token" }))
      .mockResolvedValueOnce(
        Response.json({
          id: "43",
          name: "Can connect",
          access_token: "page-token",
        }),
      );
    const provider = new FacebookVideoPublishProvider({
      apiVersion: "v25.0",
      appId: "app-id",
      appSecret: "app-secret",
    });
    expect(
      (await provider.listPages("user-token")).map(
        (page) => page.externalAccountId,
      ),
    ).toEqual(["43"]);
  });

  it.each([
    { payload: { id: "42", name: "Public Page" }, status: 200 },
    {
      payload: { id: "999", name: "Wrong Page", access_token: "page-token" },
      status: 200,
    },
    {
      payload: { error: { code: 100, message: "secret raw error" } },
      status: 400,
    },
    { payload: { error: { code: 200 } }, status: 403 },
  ])(
    "rejects inaccessible or mismatched direct lookup without treating public metadata as authorization",
    async ({ payload, status }) => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        Response.json(payload, { status }),
      );
      const provider = new FacebookVideoPublishProvider({
        apiVersion: "v25.0",
      });
      await expect(
        provider.getPage({ pageId: "42", userAccessToken: "user-token" }),
      ).rejects.toMatchObject({
        failure: {
          category: "insufficient_permissions",
          safeMessage: expect.stringContaining("Edit settings"),
        },
      });
    },
  );

  it("reports expired authorization distinctly", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ error: { code: 190 } }, { status: 400 }),
    );
    const provider = new FacebookVideoPublishProvider({ apiVersion: "v25.0" });
    await expect(
      provider.getPage({ pageId: "42", userAccessToken: "user-token" }),
    ).rejects.toMatchObject({ failure: { category: "authorization_expired" } });
  });

  it.each(["me", "../me", "42?fields=access_token", "1".repeat(33)])(
    "validates direct lookup ID %s before fetching",
    async (pageId) => {
      const fetchMock = vi.spyOn(globalThis, "fetch");
      const provider = new FacebookVideoPublishProvider({
        apiVersion: "v25.0",
      });
      await expect(
        provider.getPage({ pageId, userAccessToken: "user-token" }),
      ).rejects.toThrow();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

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
        disclosures: null,
        providerOperationId: null,
        providerOperationSecret: null,
      }),
    ).resolves.toEqual({
      externalVideoId: "video-1",
      externalVideoUrl: "https://www.facebook.com/page-42/videos/video-1",
      uploadedBytes: 4,
      completionStage: "published",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/page-42/videos");
    expect(fetchMock.mock.calls[3]?.[1]?.body?.toString()).toContain(
      "published=true",
    );
  });
});
