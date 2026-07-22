import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { InstagramVideoPublishProvider } from "@/lib/publishing/providers/instagram-video-publish-provider";
import { PublishProviderError } from "@/lib/publishing/video-publish-provider";

const provider = () =>
  new InstagramVideoPublishProvider({
    apiVersion: "v25.0",
    appId: "app-id",
    appSecret: "app-secret",
  });

const request = () => ({
  tokens: { accessToken: "access-token" },
  account: { externalAccountId: "ig-user-1" },
  sourceUrl: "https://assets.example/reel.mp4",
  sizeBytes: 1234,
  contentType: "video/mp4",
  title: "Internal label",
  description: "",
  tags: [],
  visibility: "public" as const,
  caption: "A caption #vcstudio",
  shareToFeed: true,
  providerOperationId: null,
});

afterEach(() => vi.restoreAllMocks());

describe("InstagramVideoPublishProvider", () => {
  it("creates a direct Instagram Login authorization URL", () => {
    const url = new URL(
      provider().createAuthorizationUrl({
        state: "signed-state",
        redirectUri: "https://vcstudio.example/api/instagram/callback",
      }),
    );
    expect(url.origin).toBe("https://www.instagram.com");
    expect(url.searchParams.get("enable_fb_login")).toBe("0");
    expect(url.searchParams.get("scope")).toBe(
      "instagram_business_basic,instagram_business_content_publish",
    );
  });

  it("exchanges OAuth tokens without losing precision from a numeric Instagram id", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          '{"access_token":"short-token","user_id":12345678901234567}',
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          access_token: "long-token",
          token_type: "bearer",
          expires_in: 5_184_000,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ id: "12345678901234567", username: "vcstudio" }),
      );

    const result = await provider().exchangeCode({
      code: "oauth-code",
      redirectUri: "https://vcstudio.example/api/instagram/callback",
    });

    expect(result.account.externalAccountId).toBe("12345678901234567");
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("12345678901234567");
  });

  it("creates, waits for, and publishes a Reel container", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ id: "container-1" }))
      .mockResolvedValueOnce(Response.json({ status_code: "IN_PROGRESS" }))
      .mockResolvedValueOnce(Response.json({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(Response.json({ id: "media-1" }))
      .mockResolvedValueOnce(
        Response.json({ permalink: "https://www.instagram.com/reel/media-1/" }),
      );
    const onCreated = vi.fn();
    const waitForProcessing = vi.fn().mockResolvedValue(undefined);
    const result = await provider().publishVideo({
      ...request(),
      onProviderOperationCreated: onCreated,
      waitForProcessing,
    });
    expect(onCreated).toHaveBeenCalledWith("container-1");
    expect(waitForProcessing).toHaveBeenCalledWith(5000);
    expect(result.externalVideoId).toBe("media-1");
    const createBody = fetchMock.mock.calls[0]?.[1]?.body;
    expect(createBody).toBeInstanceOf(URLSearchParams);
    expect((createBody as URLSearchParams).get("share_to_feed")).toBe("true");
  });

  it("resumes an existing container and never recreates it", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(Response.json({ id: "media-2" }))
      .mockResolvedValueOnce(
        Response.json({ permalink: "https://www.instagram.com/reel/media-2/" }),
      );
    await provider().publishVideo({
      ...request(),
      providerOperationId: "container-existing",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      "container-existing",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("marks an unconfirmed publish response as ambiguous and non-retriable", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ status_code: "FINISHED" }))
      .mockRejectedValueOnce(new Error("connection reset"));
    const error = await provider()
      .publishVideo({ ...request(), providerOperationId: "container-existing" })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PublishProviderError);
    expect((error as PublishProviderError).failure).toMatchObject({
      category: "transport_ambiguous",
      retriable: false,
      mayHavePublished: true,
    });
  });
});
