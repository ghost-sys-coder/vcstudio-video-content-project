import { describe, expect, it } from "vitest";
import {
  videoThumbnailObjectKey,
  videoThumbnailReference,
} from "./video-thumbnail";
describe("private preview storage references", () => {
  it("recognizes canonical UUID-scoped keys for indexed cleanup", () => {
    const reference = {
      workspaceId: "11111111-1111-4111-8111-111111111111",
      mediaAssetId: "22222222-2222-4222-8222-222222222222",
    };
    expect(videoThumbnailReference(videoThumbnailObjectKey(reference))).toEqual(
      reference,
    );
  });
  it.each([
    "workspaces/../library/id/poster-v1.jpg",
    "workspaces/not-a-uuid/library/id/poster-v1.jpg",
    "private/original.mp4",
    "workspaces/11111111-1111-4111-8111-111111111111/library/22222222-2222-4222-8222-222222222222/poster-v1.jpg/other",
  ])("does not treat %s as a thumbnail reference", (key) => {
    expect(videoThumbnailReference(key)).toBeNull();
  });
});
