import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { YouTubeSocialPostProvider } from "./youtube-social-post-provider";
import { YouTubeVideoPublishProvider } from "./youtube-video-publish-provider";
import type { PublishPostRequest } from "@/lib/publishing/social-post-provider";
import { socialYouTubeSettingsSchema } from "@studio/contracts/publishing";

const video = () =>
  new YouTubeVideoPublishProvider({ clientId: "test", clientSecret: "test" });
const request = (): PublishPostRequest => ({
  tokens: { accessToken: "test-token" },
  account: { externalAccountId: "my-channel" },
  text: "Shared social copy",
  media: [
    {
      kind: "video",
      sourceUrl: "https://storage.example/video.mp4",
      contentType: "video/mp4",
      sizeBytes: 4,
      altText: "",
      fileName: "video.mp4",
    },
  ],
  providerOperationId: null,
  providerOperationSecret: null,
  youtubeSettings: socialYouTubeSettingsSchema.parse({
    title: "A proper title",
    description: "Exact description",
    tags: ["VCStudio"],
    visibility: "unlisted",
    madeForKids: false,
    containsSyntheticMedia: true,
  }),
});
afterEach(() => vi.unstubAllGlobals());

describe("real Social-to-YouTube upload boundary", () => {
  it.each([{}, { madeForKids: false }])(
    "blocks unanswered creator declarations before any network call: %j",
    async (settings) => {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      await expect(
        new YouTubeSocialPostProvider(video()).publishPost({
          ...request(),
          youtubeSettings: socialYouTubeSettingsSchema.parse(settings),
        }),
      ).rejects.toMatchObject({
        failure: { category: "invalid_metadata", mayHavePublished: false },
      });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it("passes the saved metadata and declarations through the actual video provider", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 200,
          headers: { location: "https://youtube.example/upload" },
        }),
      )
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3, 4])))
      .mockResolvedValueOnce(Response.json({ id: "video123" }));
    vi.stubGlobal("fetch", fetcher);
    const checkpoint = vi.fn();
    const result = await new YouTubeSocialPostProvider(video()).publishPost({
      ...request(),
      onProviderOperationCreated: checkpoint,
    });
    const init = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(init).toEqual({
      snippet: {
        title: "A proper title",
        description: "Exact description",
        tags: ["VCStudio"],
      },
      status: {
        privacyStatus: "unlisted",
        selfDeclaredMadeForKids: false,
        containsSyntheticMedia: true,
      },
    });
    expect(checkpoint).toHaveBeenCalledWith("youtube:video:video123");
    expect(result).toMatchObject({
      externalPostId: "video123",
      completionStage: "published",
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("resumes a durable confirmed video checkpoint without uploading bytes again", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const result = await new YouTubeSocialPostProvider(video()).publishPost({
      ...request(),
      providerOperationId: "youtube:video:video123",
    });
    expect(result.externalPostId).toBe("video123");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("YouTube thumbnail processing", () => {
  const input = () => ({
    accessToken: "test",
    videoId: "video123",
    imageUrl: "https://storage.example/thumb.png",
    sizeBytes: 3,
    contentType: "image/png",
  });
  const processing = (status: string, id = "video123") =>
    Response.json({
      items: [{ id, processingDetails: { processingStatus: status } }],
    });
  it("waits for processing to succeed before reading or applying a Shorts thumbnail", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(processing("processing"))
      .mockResolvedValueOnce(processing("succeeded"))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const wait = vi.fn();
    expect(
      await video().setThumbnail({ ...input(), waitForProcessing: wait }),
    ).toEqual({ state: "succeeded", detail: null });
    expect(wait).toHaveBeenCalledWith(10000);
    expect(String(fetcher.mock.calls[0][0])).toContain(
      "part=processingDetails",
    );
    expect(fetcher.mock.calls[2][0]).toBe(input().imageUrl);
    expect(String(fetcher.mock.calls[3][0])).toContain(
      "thumbnails/set?videoId=video123",
    );
  });
  it.each(["failed", "terminated"])(
    "does not upload a thumbnail when video processing is %s",
    async (status) => {
      const fetcher = vi.fn().mockResolvedValue(processing(status));
      vi.stubGlobal("fetch", fetcher);
      expect(await video().setThumbnail(input())).toMatchObject({
        state: "failed",
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("bounds pending processing to 30 checks and leaves a thumbnail-only retry", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(async () => processing("processing"));
    vi.stubGlobal("fetch", fetcher);
    const wait = vi.fn();
    expect(
      await video().setThumbnail({ ...input(), waitForProcessing: wait }),
    ).toMatchObject({
      state: "failed",
      detail: expect.stringContaining("will not be uploaded again"),
    });
    expect(fetcher).toHaveBeenCalledTimes(30);
    expect(wait).toHaveBeenCalledTimes(29);
  });
  it("never treats another video's processing status as confirmation", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(processing("succeeded", "other-video"));
    vi.stubGlobal("fetch", fetcher);
    expect(await video().setThumbnail(input())).toMatchObject({
      state: "failed",
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("reports missing custom-thumbnail permission separately from video success", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(processing("succeeded"))
      .mockResolvedValueOnce(new Response("png"))
      .mockResolvedValueOnce(new Response(null, { status: 403 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await video().setThumbnail(input())).toMatchObject({
      state: "unsupported",
    });
  });
});
