import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createTikTokChunkPlan,
  TikTokVideoUploadProvider,
} from "@/lib/publishing/providers/tiktok-video-upload-provider";
import { PublishProviderError } from "@/lib/publishing/video-publish-provider";

const provider = () =>
  new TikTokVideoUploadProvider({
    clientKey: "client-key",
    clientSecret: "client-secret",
  });

const request = () => ({
  tokens: { accessToken: "access-token" },
  account: { externalAccountId: "open-id" },
  sourceUrl: "https://private.example/render.mp4?signature=secret",
  sizeBytes: 4,
  contentType: "video/mp4",
  title: "TikTok inbox upload",
  description: "",
  tags: [],
  visibility: "platform_default" as const,
  caption: null,
  shareToFeed: null,
  providerOperationId: null,
  providerOperationSecret: null,
});

afterEach(() => vi.restoreAllMocks());

describe("TikTokVideoUploadProvider", () => {
  it("requests only basic profile and inbox-upload scopes", () => {
    const url = new URL(
      provider().createAuthorizationUrl({
        state: "signed-state",
        redirectUri: "https://vcstudio.example/api/tiktok/callback",
      }),
    );
    expect(url.origin).toBe("https://www.tiktok.com");
    expect(url.searchParams.get("scope")).toBe("user.info.basic,video.upload");
    expect(url.searchParams.get("scope")).not.toContain("video.publish");
  });

  it("exchanges OAuth tokens and resolves the connected account", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          open_id: "open-id",
          scope: "user.info.basic,video.upload",
          access_token: "access-token",
          expires_in: 86_400,
          refresh_token: "refresh-token",
          refresh_expires_in: 31_536_000,
          token_type: "Bearer",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { user: { open_id: "open-id", display_name: "Creator" } },
          error: { code: "ok", message: "", log_id: "log-1" },
        }),
      );
    const result = await provider().exchangeCode({
      code: "code",
      redirectUri: "https://vcstudio.example/api/tiktok/callback",
    });
    expect(result.account).toEqual({
      externalAccountId: "open-id",
      externalAccountName: "Creator",
      externalAccountUrl: null,
    });
    expect(result.tokens.refreshToken).toBe("refresh-token");
  });

  it("initializes, uploads, and confirms inbox delivery", async () => {
    const onCreated = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          data: {
            publish_id: "publish-1",
            upload_url: "https://upload.tiktokapis.com/session",
          },
          error: { code: "ok", message: "", log_id: "log-1" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3, 4]), { status: 206 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(
        Response.json({
          data: { status: "SEND_TO_USER_INBOX", uploaded_bytes: 4 },
          error: { code: "ok", message: "", log_id: "log-2" },
        }),
      );
    const result = await provider().publishVideo({
      ...request(),
      onProviderOperationCreated: onCreated,
    });
    expect(onCreated).toHaveBeenCalledWith(
      "publish-1",
      "https://upload.tiktokapis.com/session",
    );
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({
      Range: "bytes=0-3",
    });
    expect(fetchMock.mock.calls[2]?.[1]?.headers).toMatchObject({
      "Content-Range": "bytes 0-3/4",
    });
    expect(result).toMatchObject({
      externalVideoId: "publish-1",
      completionStage: "inbox_delivered",
      uploadedBytes: 4,
    });
  });

  it("resumes from TikTok's confirmed uploaded byte count", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          data: { status: "PROCESSING_UPLOAD", uploaded_bytes: 2 },
          error: { code: "ok", message: "", log_id: "log-1" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([3, 4]), { status: 206 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(
        Response.json({
          data: { status: "SEND_TO_USER_INBOX", uploaded_bytes: 4 },
          error: { code: "ok", message: "", log_id: "log-2" },
        }),
      );
    await provider().publishVideo({
      ...request(),
      providerOperationId: "publish-existing",
      providerOperationSecret: "https://upload.tiktokapis.com/session",
    });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toEqual({
      Range: "bytes=2-3",
    });
  });

  it("classifies an ambiguous chunk transfer as safely reconcilable", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        Response.json({
          data: {
            publish_id: "publish-1",
            upload_url: "https://upload.tiktokapis.com/session",
          },
          error: { code: "ok", message: "", log_id: "log-1" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3, 4]), { status: 206 }),
      )
      .mockRejectedValueOnce(new Error("connection reset"));
    const error = await provider()
      .publishVideo(request())
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PublishProviderError);
    expect((error as PublishProviderError).failure).toMatchObject({
      category: "transport_ambiguous",
      retriable: true,
      mayHavePublished: false,
    });
  });

  it("creates TikTok-compliant chunk plans", () => {
    expect(createTikTokChunkPlan(4 * 1024 * 1024)).toEqual({
      chunkSize: 4 * 1024 * 1024,
      totalChunkCount: 1,
    });
    expect(createTikTokChunkPlan(129 * 1024 * 1024)).toEqual({
      chunkSize: 64 * 1024 * 1024,
      totalChunkCount: 2,
    });
  });
});
