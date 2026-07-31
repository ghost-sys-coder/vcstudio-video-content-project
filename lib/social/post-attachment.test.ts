import { describe, expect, it } from "vitest";
import type { MediaAsset, VideoRender } from "@/db/schema";
import {
  buildRenderAttachmentTitle,
  toLibraryAttachment,
  toRenderAttachment,
} from "@/lib/social/post-attachment";

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    kind: "image",
    objectKey: "workspaces/w/library/a.png",
    contentType: "image/png",
    sizeBytes: 1024,
    originalFileName: "a.png",
    width: 800,
    height: 600,
    durationMilliseconds: null,
    title: "",
    altText: "A chart",
    tags: [],
    status: "ready",
    uploadedByUserId: "33333333-3333-4333-8333-333333333333",
    deletedAt: null,
    createdAt: new Date("2026-07-01T00:00:00Z"),
    updatedAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  } as MediaAsset;
}

function makeRender(overrides: Partial<VideoRender> = {}): VideoRender {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    projectId: "55555555-5555-4555-8555-555555555555",
    status: "succeeded",
    width: 1080,
    height: 1920,
    durationMilliseconds: 42_000,
    outputDurationMilliseconds: null,
    assetObjectKey: "workspaces/w/projects/p/renders/r.mp4",
    assetContentType: "video/mp4",
    assetSizeBytes: 5_000_000,
    createdAt: new Date("2026-07-02T00:00:00Z"),
    ...overrides,
  } as VideoRender;
}

describe("toLibraryAttachment", () => {
  it("falls back to the file name when the author gave no title", () => {
    const attachment = toLibraryAttachment({
      linkId: "l1",
      position: 0,
      asset: makeAsset({ title: "  " }),
    });
    expect(attachment.title).toBe("a.png");
  });

  it("marks a soft-deleted asset unavailable so publishing refuses it", () => {
    const attachment = toLibraryAttachment({
      linkId: "l1",
      position: 0,
      asset: makeAsset({ deletedAt: new Date("2026-07-05T00:00:00Z") }),
    });
    expect(attachment.unavailable).toBe(true);
    expect(attachment.source).toBe("library");
  });
});

describe("toRenderAttachment", () => {
  it("always reports a render as video", () => {
    expect(
      toRenderAttachment({ linkId: "l1", position: 0, render: makeRender() })
        .kind,
    ).toBe("video");
  });

  it("prefers the measured output duration over the planned one", () => {
    const attachment = toRenderAttachment({
      linkId: "l1",
      position: 0,
      render: makeRender({ outputDurationMilliseconds: 41_500 }),
    });
    expect(attachment.durationMilliseconds).toBe(41_500);
  });

  it("is unavailable when the render never produced a file", () => {
    expect(
      toRenderAttachment({
        linkId: "l1",
        position: 0,
        render: makeRender({ status: "failed", assetObjectKey: null }),
      }).unavailable,
    ).toBe(true);
  });

  it("is unavailable when a succeeded render has no recorded size", () => {
    expect(
      toRenderAttachment({
        linkId: "l1",
        position: 0,
        render: makeRender({ assetSizeBytes: null }),
      }).unavailable,
    ).toBe(true);
  });

  it("defaults the content type rather than sending an empty one", () => {
    expect(
      toRenderAttachment({
        linkId: "l1",
        position: 0,
        render: makeRender({ assetContentType: null }),
      }).contentType,
    ).toBe("video/mp4");
  });
});

describe("buildRenderAttachmentTitle", () => {
  it("states the dimensions and runtime that decide platform acceptance", () => {
    expect(buildRenderAttachmentTitle(makeRender())).toBe("1080×1920 · 0:42");
  });

  it("pads seconds past a minute", () => {
    expect(
      buildRenderAttachmentTitle(makeRender({ durationMilliseconds: 125_000 })),
    ).toBe("1080×1920 · 2:05");
  });
});
