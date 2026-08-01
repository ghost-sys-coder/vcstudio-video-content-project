import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { PublishPostRequest } from "@/lib/publishing/social-post-provider";
import { TwitterSocialPostProvider } from "@/lib/publishing/providers/twitter-social-post-provider";
import { PublishProviderError } from "@/lib/publishing/video-publish-provider";

const provider = () => new TwitterSocialPostProvider();

function request(
  overrides: Partial<PublishPostRequest> = {},
): PublishPostRequest {
  return {
    tokens: { accessToken: "access-token" },
    account: { externalAccountId: "1234" },
    text: "Hello from the studio",
    media: [],
    providerOperationId: null,
    providerOperationSecret: null,
    ...overrides,
  };
}

const image = {
  kind: "image" as const,
  sourceUrl: "https://private.example/photo.png?signature=secret",
  contentType: "image/png",
  sizeBytes: 4,
  altText: "A photo",
  fileName: "photo.png",
};

const video = {
  kind: "video" as const,
  sourceUrl: "https://private.example/clip.mp4?signature=secret",
  contentType: "video/mp4",
  sizeBytes: 8,
  altText: "",
  fileName: "clip.mp4",
};

function bytes(): Response {
  return new Response(new Uint8Array([1, 2, 3, 4]));
}

afterEach(() => vi.restoreAllMocks());

describe("TwitterSocialPostProvider", () => {
  it("posts text on its own without touching the media endpoints", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ data: { id: "9001" } }));

    const result = await provider().publishPost(request());

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      "https://api.x.com/2/tweets",
    );
    const body = JSON.parse(
      String(fetchSpy.mock.calls[0]?.[1]?.body),
    ) as Record<string, unknown>;
    expect(body).toEqual({ text: "Hello from the studio" });
    expect(result).toEqual({
      externalPostId: "9001",
      externalPostUrl: "https://x.com/i/web/status/9001",
      completionStage: "published",
    });
  });

  it("uploads images first and references them by id, in order", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(bytes())
      .mockResolvedValueOnce(Response.json({ data: { id: "media-1" } }))
      .mockResolvedValueOnce(bytes())
      .mockResolvedValueOnce(Response.json({ data: { id: "media-2" } }))
      .mockResolvedValueOnce(Response.json({ data: { id: "9002" } }));

    await provider().publishPost(
      request({ media: [image, { ...image, fileName: "second.png" }] }),
    );

    const body = JSON.parse(
      String(fetchSpy.mock.calls[4]?.[1]?.body),
    ) as Record<string, unknown>;
    // Order is the author's carousel order and must survive the upload round.
    expect(body.media).toEqual({ media_ids: ["media-1", "media-2"] });
  });

  it("tags a GIF with its own media category", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(bytes())
      .mockResolvedValueOnce(Response.json({ data: { id: "media-1" } }))
      .mockResolvedValueOnce(Response.json({ data: { id: "9003" } }));

    await provider().publishPost(
      request({
        media: [{ ...image, contentType: "image/gif", fileName: "loop.gif" }],
      }),
    );

    const form = fetchSpy.mock.calls[1]?.[1]?.body as FormData;
    // Sending tweet_image for a GIF is accepted at upload and then rejected at
    // post time, which is the worst possible place to find out.
    expect(form.get("media_category")).toBe("tweet_gif");
  });

  it("waits for a video to finish transcoding before posting", async () => {
    const waitForProcessing = vi.fn(async () => undefined);
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ data: { id: "media-9" } }))
      .mockResolvedValueOnce(bytes())
      .mockResolvedValueOnce(Response.json({ data: { id: "media-9" } }))
      .mockResolvedValueOnce(
        Response.json({
          data: {
            id: "media-9",
            processing_info: { state: "in_progress", check_after_secs: 3 },
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: { id: "media-9", processing_info: { state: "succeeded" } },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: { id: "9004" } }));

    await provider().publishPost(
      request({ media: [video], waitForProcessing }),
    );

    expect(waitForProcessing).toHaveBeenCalledWith(3000);
    // The post must be the last call — referencing media still in progress is
    // rejected, so ordering here is correctness, not politeness.
    expect(String(fetchSpy.mock.calls.at(-1)?.[0])).toBe(
      "https://api.x.com/2/tweets",
    );
  });

  it("reports a video X could not process as rejected, not retriable", async () => {
    vi.spyOn(globalThis, "fetch")
      // initialize, source bytes, append, finalize
      .mockResolvedValueOnce(Response.json({ data: { id: "media-9" } }))
      .mockResolvedValueOnce(bytes())
      .mockResolvedValueOnce(Response.json({ data: { id: "media-9" } }))
      .mockResolvedValueOnce(
        Response.json({
          data: { id: "media-9", processing_info: { state: "failed" } },
        }),
      );

    const error = await provider()
      .publishPost(request({ media: [video] }))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PublishProviderError);
    expect((error as PublishProviderError).failure.category).toBe(
      "video_rejected",
    );
    expect((error as PublishProviderError).failure.retriable).toBe(false);
  });

  it("separates a duplicate rejection from a permissions problem", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json(
        {
          detail:
            "You are not allowed to create a Tweet with duplicate content.",
        },
        { status: 403 },
      ),
    );
    const error = await provider()
      .publishPost(request())
      .catch((caught: unknown) => caught);
    const failure = (error as PublishProviderError).failure;
    // Both arrive as 403, but "you already posted this" and "your account
    // cannot post" ask completely different things of the user.
    expect(failure.category).toBe("invalid_metadata");
    expect(failure.safeMessage).toContain("duplicate");
  });

  it("classifies a genuine 403 as insufficient permissions", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      Response.json({ detail: "Unsupported Authentication" }, { status: 403 }),
    );
    const error = await provider()
      .publishPost(request())
      .catch((caught: unknown) => caught);
    expect((error as PublishProviderError).failure.category).toBe(
      "insufficient_permissions",
    );
  });

  it("classifies an expired token so the connection can be reconnected", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", { status: 401 }),
    );
    const error = await provider()
      .publishPost(request())
      .catch((caught: unknown) => caught);
    expect((error as PublishProviderError).failure.category).toBe(
      "authorization_expired",
    );
  });

  it("treats rate limiting as retriable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", { status: 429 }),
    );
    const error = await provider()
      .publishPost(request())
      .catch((caught: unknown) => caught);
    const failure = (error as PublishProviderError).failure;
    expect(failure.category).toBe("rate_limited");
    expect(failure.retriable).toBe(true);
  });

  it("marks a mid-flight transport failure ambiguous so it is never retried", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("socket hang up"),
    );
    const error = await provider()
      .publishPost(request())
      .catch((caught: unknown) => caught);
    const failure = (error as PublishProviderError).failure;
    // The request left; whether X acted on it is unknown, and a retry would
    // double-post.
    expect(failure.category).toBe("transport_ambiguous");
    expect(failure.mayHavePublished).toBe(true);
    expect(failure.retriable).toBe(false);
  });

  it("reports an unreadable attachment as an asset problem", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", { status: 404 }),
    );
    const error = await provider()
      .publishPost(request({ media: [image] }))
      .catch((caught: unknown) => caught);
    expect((error as PublishProviderError).failure.category).toBe(
      "asset_unavailable",
    );
  });

  it("never sends the signed source URL to X", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(bytes())
      .mockResolvedValueOnce(Response.json({ data: { id: "media-1" } }))
      .mockResolvedValueOnce(Response.json({ data: { id: "9005" } }));

    await provider().publishPost(request({ media: [image] }));

    const sentToX = fetchSpy.mock.calls
      .slice(1)
      .map((call) => `${String(call[0])} ${String(call[1]?.body ?? "")}`)
      .join(" ");
    expect(sentToX).not.toContain("signature=secret");
  });
});
