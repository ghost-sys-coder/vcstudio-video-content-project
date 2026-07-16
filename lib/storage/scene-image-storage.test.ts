import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env/server", () => ({
  getStorageEnvironment: () => ({
    R2_BUCKET_NAME: "test-bucket",
    R2_SIGNED_DOWNLOAD_EXPIRY_SECONDS: 300,
  }),
}));

vi.mock("@/lib/storage/r2-client", () => ({
  getR2Client: () => ({ send: mocks.send }),
}));

import {
  downloadSceneImageReferences,
  putSceneImage,
} from "@/lib/storage/scene-image-storage";

describe("scene image storage", () => {
  beforeEach(() => {
    mocks.send.mockReset();
    mocks.send.mockImplementation(async (command: unknown) => {
      const input =
        typeof command === "object" && command !== null
          ? Reflect.get(command, "input")
          : null;
      if (typeof input === "object" && input !== null && "Body" in input)
        return { ETag: '"stored-etag"' };
      if (typeof input === "object" && input !== null && "Key" in input)
        return {
          ETag: Reflect.get(input, "IfMatch"),
          ContentLength: 3,
          Body: {
            transformToByteArray: async () => new Uint8Array([1, 2, 3]),
          },
        };
      throw new Error("Unexpected R2 command.");
    });
  });

  it("uploads provider bytes to the deterministic key with recovery metadata", async () => {
    const stored = await putSceneImage({
      objectKey:
        "workspaces/workspace/projects/project/scenes/scene/versions/version/images/generation.webp",
      generationId: "generation-id",
      actualCostCents: 7,
      costBasis: "provider_usage",
      result: {
        provider: "openai",
        operation: "generate",
        model: "gpt-image-2",
        requestId: "request-id",
        bytes: new Uint8Array([1, 2, 3, 4]),
        mimeType: "image/webp",
        width: 1536,
        height: 1024,
        usage: {
          inputTextTokens: 20,
          inputImageTokens: 0,
          outputTokens: 2000,
          totalTokens: 2020,
        },
        safeMetadata: {
          createdAtEpochSeconds: 1,
          outputFormat: "webp",
          quality: "medium",
          size: "1536x1024",
          referenceCount: 0,
        },
      },
    });

    expect(stored).toMatchObject({
      etag: '"stored-etag"',
      actualCostCents: 7,
      providerRequestId: "request-id",
      outputUnits: 2000,
    });
    const command = mocks.send.mock.calls[0]?.[0];
    if (typeof command !== "object" || command === null)
      throw new Error("Expected a PutObjectCommand.");
    const commandInput = Reflect.get(command, "input");
    expect(commandInput).toMatchObject({
      Bucket: "test-bucket",
      ContentType: "image/webp",
      ContentLength: 4,
      Metadata: {
        "generation-id": "generation-id",
        "provider-request-id": "request-id",
        "actual-cost-cents": "7",
        "cost-basis": "provider_usage",
      },
    });
  });

  it("sorts reference IDs and enforces the aggregate byte limit", async () => {
    const references = await downloadSceneImageReferences({
      references: [
        {
          referenceAssetIdSnapshot: "b",
          objectKeySnapshot: "b.webp",
          contentTypeSnapshot: "image/webp",
          etagSnapshot: '"b-etag"',
        },
        {
          referenceAssetIdSnapshot: "a",
          objectKeySnapshot: "a.webp",
          contentTypeSnapshot: "image/webp",
          etagSnapshot: '"a-etag"',
        },
      ],
      maximumTotalBytes: 6,
    });
    expect(references.map(({ assetId }) => assetId)).toEqual(["a", "b"]);
    const firstDownload = mocks.send.mock.calls[0]?.[0];
    if (typeof firstDownload !== "object" || firstDownload === null)
      throw new Error("Expected a GetObjectCommand.");
    expect(Reflect.get(firstDownload, "input")).toMatchObject({
      Key: "a.webp",
      IfMatch: '"a-etag"',
    });

    await expect(
      downloadSceneImageReferences({
        references: [
          {
            referenceAssetIdSnapshot: "a",
            objectKeySnapshot: "a.webp",
            contentTypeSnapshot: "image/webp",
            etagSnapshot: '"a-etag"',
          },
        ],
        maximumTotalBytes: 2,
      }),
    ).rejects.toThrow("REFERENCE_TOTAL_SIZE_EXCEEDED");
  });

  it("rejects a reference when R2 no longer returns the snapshotted ETag", async () => {
    mocks.send.mockResolvedValueOnce({
      ETag: '"changed-etag"',
      ContentLength: 3,
      Body: {
        transformToByteArray: async () => new Uint8Array([1, 2, 3]),
      },
    });

    await expect(
      downloadSceneImageReferences({
        references: [
          {
            referenceAssetIdSnapshot: "a",
            objectKeySnapshot: "a.webp",
            contentTypeSnapshot: "image/webp",
            etagSnapshot: '"original-etag"',
          },
        ],
        maximumTotalBytes: 3,
      }),
    ).rejects.toThrow("REFERENCE_ETAG_MISMATCH");
  });
});
