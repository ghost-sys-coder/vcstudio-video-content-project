import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { InstagramSocialPostProvider } from "@/lib/publishing/providers/instagram-social-post-provider";
import { PublishProviderError } from "@/lib/publishing/video-publish-provider";

const videoProvider = {
  platform: "instagram" as const,
  accountLabel: "Instagram account",
  createAuthorizationUrl: vi.fn(),
  exchangeCode: vi.fn(),
  refreshTokens: vi.fn(),
  fetchAccount: vi.fn(),
  publishVideo: vi.fn(),
};

const provider = () =>
  new InstagramSocialPostProvider({
    apiVersion: "v25.0",
    videoProvider,
  });

const request = () => ({
  tokens: { accessToken: "instagram-access-token" },
  account: { externalAccountId: "ig-user-1" },
  text: "A caption #vcstudio",
  media: [
    {
      kind: "image" as const,
      sourceUrl: "https://assets.example/post.jpg",
      contentType: "image/jpeg",
      sizeBytes: 1234,
      altText: "A product photograph",
      fileName: "post.jpg",
    },
  ],
  providerOperationId: null,
  providerOperationSecret: null,
});

afterEach(() => vi.restoreAllMocks());

describe("InstagramSocialPostProvider", () => {
  it("creates and publishes image containers through the Instagram Graph API", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ id: "container-1" }))
      .mockResolvedValueOnce(Response.json({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(Response.json({ id: "media-1" }))
      .mockResolvedValueOnce(
        Response.json({ permalink: "https://www.instagram.com/p/media-1/" }),
      );

    const result = await provider().publishPost(request());

    expect(fetchMock).toHaveBeenCalledTimes(4);
    for (const [url] of fetchMock.mock.calls)
      expect(new URL(String(url)).origin).toBe("https://graph.instagram.com");
    expect(result).toMatchObject({
      externalPostId: "media-1",
      externalPostUrl: "https://www.instagram.com/p/media-1/",
    });
  });

  it("recognizes Meta error code 190 as expired authorization", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json(
        { error: { code: 190, error_subcode: 463 } },
        { status: 400 },
      ),
    );

    const error = await provider()
      .publishPost(request())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PublishProviderError);
    expect((error as PublishProviderError).failure).toMatchObject({
      category: "authorization_expired",
      retriable: false,
      mayHavePublished: false,
    });
  });

  it("waits for the container to finish processing before publishing", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ id: "container-1" }))
      .mockResolvedValueOnce(Response.json({ status_code: "IN_PROGRESS" }))
      .mockResolvedValueOnce(Response.json({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(Response.json({ id: "media-1" }))
      .mockResolvedValueOnce(Response.json({}));
    const waitForProcessing = vi.fn().mockResolvedValue(undefined);

    await provider().publishPost({ ...request(), waitForProcessing });

    expect(waitForProcessing).toHaveBeenCalledExactlyOnceWith(3000);
    const paths = fetchMock.mock.calls.map(
      ([url]) => new URL(String(url)).pathname,
    );
    expect(paths.indexOf("/v25.0/ig-user-1/media_publish")).toBe(3);
  });

  it("treats 'media not ready' as unpublished and retryable", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ id: "container-1" }))
      .mockResolvedValueOnce(Response.json({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(
        Response.json(
          { error: { code: 9007, error_subcode: 2207027 } },
          { status: 400 },
        ),
      );

    const error = await provider()
      .publishPost(request())
      .catch((caught: unknown) => caught);

    expect((error as PublishProviderError).failure).toMatchObject({
      retriable: true,
      mayHavePublished: false,
    });
  });

  it("resumes a previous attempt's container instead of creating another", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(Response.json({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(Response.json({ id: "media-1" }))
      .mockResolvedValueOnce(Response.json({}));
    const onProviderOperationCreated = vi.fn();

    const result = await provider().publishPost({
      ...request(),
      providerOperationId: "container-old",
      onProviderOperationCreated,
    });

    expect(result.externalPostId).toBe("media-1");
    expect(onProviderOperationCreated).not.toHaveBeenCalled();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        new URL(String(url)).pathname.endsWith("/ig-user-1/media"),
      ),
    ).toBe(false);
  });

  it("rebuilds an expired container, which was never published", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ status_code: "EXPIRED" }))
      .mockResolvedValueOnce(Response.json({ id: "container-new" }))
      .mockResolvedValueOnce(Response.json({ status_code: "FINISHED" }))
      .mockResolvedValueOnce(Response.json({ id: "media-1" }))
      .mockResolvedValueOnce(Response.json({}));
    const onProviderOperationCreated = vi.fn();

    await provider().publishPost({
      ...request(),
      providerOperationId: "container-old",
      onProviderOperationCreated,
    });

    expect(onProviderOperationCreated).toHaveBeenCalledExactlyOnceWith(
      "container-new",
    );
    expect(String(fetchMock.mock.calls[3]?.[1]?.body)).toBe(
      "creation_id=container-new",
    );
  });

  it("fails without publishing when Instagram cannot process the images", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ id: "container-1" }))
      .mockResolvedValueOnce(Response.json({ status_code: "ERROR" }));

    const error = await provider()
      .publishPost(request())
      .catch((caught: unknown) => caught);

    expect((error as PublishProviderError).failure).toMatchObject({
      retriable: false,
      mayHavePublished: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("turns container transport failures into typed retryable failures", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new TypeError("fetch failed"),
    );

    const error = await provider()
      .publishPost(request())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PublishProviderError);
    expect((error as PublishProviderError).failure).toMatchObject({
      category: "network_unreachable",
      retriable: true,
      mayHavePublished: false,
    });
  });
});
