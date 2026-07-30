import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { toVideoPublishRequest } from "@/lib/publishing/providers/video-post-adapter";
import { PublishProviderError } from "@/lib/publishing/video-publish-provider";
import type { PublishPostRequest } from "@/lib/publishing/social-post-provider";

function request(
  overrides: Partial<PublishPostRequest> = {},
): PublishPostRequest {
  return {
    tokens: { accessToken: "token" },
    account: { externalAccountId: "account-1" },
    text: "First line of the post\n\nAnd a second paragraph.",
    media: [
      {
        kind: "video",
        sourceUrl: "https://storage.example/clip.mp4?signed",
        contentType: "video/mp4",
        sizeBytes: 1024,
        altText: "",
        fileName: "clip.mp4",
      },
    ],
    providerOperationId: null,
    providerOperationSecret: null,
    ...overrides,
  };
}

describe("toVideoPublishRequest", () => {
  it("derives a title from the first line and keeps the body as the description", () => {
    const mapped = toVideoPublishRequest(request());
    expect(mapped.title).toBe("First line of the post");
    expect(mapped.description).toBe(
      "First line of the post\n\nAnd a second paragraph.",
    );
    expect(mapped.caption).toBe(mapped.description);
  });

  it("publishes publicly, because a post is something someone chose to send", () => {
    expect(toVideoPublishRequest(request()).visibility).toBe("public");
    expect(toVideoPublishRequest(request()).tags).toEqual([]);
  });

  it("caps an overlong first line rather than sending an invalid title", () => {
    const mapped = toVideoPublishRequest(request({ text: "a".repeat(300) }));
    expect(mapped.title).toHaveLength(100);
  });

  it("falls back to a placeholder title for a media-only post", () => {
    expect(toVideoPublishRequest(request({ text: "" })).title).toBe(
      "Untitled post",
    );
  });

  it("carries the video's own source, size, and content type", () => {
    const mapped = toVideoPublishRequest(request());
    expect(mapped.sourceUrl).toBe("https://storage.example/clip.mp4?signed");
    expect(mapped.sizeBytes).toBe(1024);
    expect(mapped.contentType).toBe("video/mp4");
  });

  it("refuses a post with no video, rather than sending an empty upload", () => {
    expect(() => toVideoPublishRequest(request({ media: [] }))).toThrow(
      PublishProviderError,
    );
  });

  it("refuses a post whose only attachment is an image", () => {
    expect(() =>
      toVideoPublishRequest(
        request({
          media: [
            {
              kind: "image",
              sourceUrl: "https://storage.example/a.png?signed",
              contentType: "image/png",
              sizeBytes: 10,
              altText: "",
              fileName: "a.png",
            },
          ],
        }),
      ),
    ).toThrow(PublishProviderError);
  });

  it("passes the resumable operation fields straight through", () => {
    const mapped = toVideoPublishRequest(
      request({
        providerOperationId: "container-1",
        providerOperationSecret: "upload-url",
      }),
    );
    expect(mapped.providerOperationId).toBe("container-1");
    expect(mapped.providerOperationSecret).toBe("upload-url");
  });
});
