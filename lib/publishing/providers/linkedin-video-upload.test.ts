import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { uploadLinkedInVideo } from "./linkedin-video-upload";
import { LinkedInSocialPostProvider } from "./linkedin-social-post-provider";
import type { SocialPostMediaItem } from "@/lib/publishing/social-post-provider";

const request = vi.fn<typeof fetch>();
const item: SocialPostMediaItem = {
  kind: "video",
  sourceUrl: "https://storage.test/private-video",
  contentType: "video/mp4",
  sizeBytes: 6,
  altText: "",
  fileName: "clip.mp4",
};
const input = {
  item,
  owner: "urn:li:organization:42",
  accessToken: "token",
  apiVersion: "202607",
  waitForProcessing: vi.fn<(milliseconds: number) => Promise<void>>(),
};
const parts = [
  {
    firstByte: 0,
    lastByte: 2,
    uploadUrl: "https://www.linkedin.com/upload/part1",
  },
  {
    firstByte: 3,
    lastByte: 5,
    uploadUrl: "https://www.linkedin.com/upload/part2",
  },
];
function json(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200 });
}
function initialize(instructions = parts) {
  return json({
    value: {
      video: "urn:li:video:video1",
      uploadToken: "upload-token",
      uploadInstructions: instructions,
    },
  });
}
function range(start: number, end: number) {
  return new Response(new Uint8Array(end - start + 1), {
    status: 206,
    headers: { "content-range": `bytes ${start}-${end}/6` },
  });
}
function seedTransfer() {
  request
    .mockResolvedValueOnce(initialize())
    .mockResolvedValueOnce(range(0, 2))
    .mockResolvedValueOnce(
      new Response(null, { status: 201, headers: { etag: '"part-one"' } }),
    )
    .mockResolvedValueOnce(range(3, 5))
    .mockResolvedValueOnce(
      new Response(null, { status: 201, headers: { etag: '"part-two"' } }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 202 }));
}
beforeEach(() => {
  request.mockReset();
  input.waitForProcessing.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("fetch", request);
});
afterEach(() => vi.unstubAllGlobals());

describe("LinkedIn multipart video publishing", () => {
  it.each([
    [401, "authorization_expired"],
    [403, "insufficient_permissions"],
    [426, "provider_version_retired"],
  ])(
    "classifies HTTP %s before reading or uploading private media",
    async (status, category) => {
      request.mockResolvedValueOnce(
        new Response(null, { status: Number(status) }),
      );
      await expect(uploadLinkedInVideo(input)).rejects.toMatchObject({
        failure: { category, retriable: false, mayHavePublished: false },
      });
      expect(request).toHaveBeenCalledOnce();
    },
  );
  it("uploads bounded ranges, preserves part order and waits before creating the Page post", async () => {
    seedTransfer();
    request
      .mockResolvedValueOnce(json({ status: "PROCESSING" }))
      .mockResolvedValueOnce(json({ status: "AVAILABLE" }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 201,
          headers: { "x-restli-id": "urn:li:share:post1" },
        }),
      );
    await expect(
      new LinkedInSocialPostProvider({ apiVersion: "202607" }).publishPost({
        tokens: { accessToken: "token" },
        account: { externalAccountId: input.owner },
        text: "Reviewed video",
        media: [item],
        providerOperationId: null,
        providerOperationSecret: null,
        waitForProcessing: input.waitForProcessing,
      }),
    ).resolves.toMatchObject({ externalPostId: "urn:li:share:post1" });
    expect(request.mock.calls[1]?.[1]?.headers).toMatchObject({
      Range: "bytes=0-2",
    });
    expect(request.mock.calls[3]?.[1]?.headers).toMatchObject({
      Range: "bytes=3-5",
    });
    expect(JSON.parse(String(request.mock.calls[5]?.[1]?.body))).toEqual({
      finalizeUploadRequest: {
        video: "urn:li:video:video1",
        uploadToken: "upload-token",
        uploadedPartIds: ["part-one", "part-two"],
      },
    });
    expect(input.waitForProcessing).toHaveBeenCalledExactlyOnceWith(5000);
    expect(JSON.parse(String(request.mock.calls[8]?.[1]?.body))).toMatchObject({
      author: input.owner,
      content: { media: { id: "urn:li:video:video1" } },
    });
  });
  it.each([
    [{ ...parts[0], firstByte: 1 }],
    [parts[0]],
    [parts[1], parts[0]],
    [{ ...parts[0], lastByte: 6 }],
    [{ ...parts[0], uploadUrl: "https://attacker.test/upload" }, parts[1]],
  ])(
    "rejects incomplete, overlapping, unordered or foreign upload instructions: %j",
    async (...instructions) => {
      request.mockResolvedValueOnce(initialize(instructions));
      await expect(uploadLinkedInVideo(input)).rejects.toThrow();
      expect(request).toHaveBeenCalledOnce();
    },
  );
  it("rejects storage ignoring a partial Range request before reading the full file", async () => {
    request
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(new Response(new Uint8Array(6), { status: 200 }));
    await expect(uploadLinkedInVideo(input)).rejects.toMatchObject({
      failure: { category: "asset_unavailable", mayHavePublished: false },
    });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("rejects oversized source chunks and never finalizes them", async () => {
    request.mockResolvedValueOnce(initialize()).mockResolvedValueOnce(
      new Response(new Uint8Array(4), {
        status: 206,
        headers: { "content-range": "bytes 0-2/6" },
      }),
    );
    await expect(uploadLinkedInVideo(input)).rejects.toMatchObject({
      failure: { category: "asset_unavailable" },
    });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("refuses to finalize without an upload acknowledgement", async () => {
    request
      .mockResolvedValueOnce(initialize())
      .mockResolvedValueOnce(range(0, 2))
      .mockResolvedValueOnce(new Response(null, { status: 201 }));
    await expect(uploadLinkedInVideo(input)).rejects.toThrow("did not confirm");
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("does not create a post when LinkedIn rejects video processing", async () => {
    seedTransfer();
    request.mockResolvedValueOnce(json({ status: "PROCESSING_FAILED" }));
    await expect(uploadLinkedInVideo(input)).rejects.toMatchObject({
      failure: { category: "video_rejected", mayHavePublished: false },
    });
    expect(
      request.mock.calls.some(([url]) => String(url).endsWith("/posts")),
    ).toBe(false);
  });
  it("bounds processing polls", async () => {
    seedTransfer();
    request.mockImplementation(async () => json({ status: "PROCESSING" }));
    await expect(uploadLinkedInVideo(input)).rejects.toThrow(
      "still processing",
    );
    expect(input.waitForProcessing).toHaveBeenCalledTimes(23);
    expect(request).toHaveBeenCalledTimes(30);
  });
});
