import { describe, expect, it } from "vitest";
import {
  MAX_PUBLICATION_TAGS,
  MAX_PUBLICATION_TAG_LENGTH,
  publishVideoSchema,
} from "@/lib/schemas/publishing";

const base = {
  projectId: "6f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b",
  renderId: "7f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4c",
  connectionId: "8f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4d",
  platform: "youtube",
  title: "How bridges fail",
  visibility: "private",
  requestNonce: "nonce-1",
};

describe("publishVideoSchema", () => {
  it("accepts a minimal valid request and defaults optional fields", () => {
    const result = publishVideoSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success && result.data.platform === "youtube") {
      expect(result.data.description).toBe("");
      expect(result.data.tags).toEqual([]);
    }
  });

  it("splits, trims, and drops empty tags", () => {
    const result = publishVideoSchema.safeParse({
      ...base,
      tags: " focus , , productivity ,",
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.platform === "youtube")
      expect(result.data.tags).toEqual(["focus", "productivity"]);
  });

  it("requires a non-empty title", () => {
    expect(
      publishVideoSchema.safeParse({ ...base, title: "   " }).success,
    ).toBe(false);
  });

  it("rejects a title beyond YouTube's 100-character limit", () => {
    expect(
      publishVideoSchema.safeParse({ ...base, title: "x".repeat(101) }).success,
    ).toBe(false);
    expect(
      publishVideoSchema.safeParse({ ...base, title: "x".repeat(100) }).success,
    ).toBe(true);
  });

  it("rejects a description beyond the 5000-character limit", () => {
    expect(
      publishVideoSchema.safeParse({ ...base, description: "x".repeat(5001) })
        .success,
    ).toBe(false);
  });

  it("rejects too many tags and over-long tags", () => {
    expect(
      publishVideoSchema.safeParse({
        ...base,
        tags: Array.from(
          { length: MAX_PUBLICATION_TAGS + 1 },
          (_, i) => `t${i}`,
        ).join(","),
      }).success,
    ).toBe(false);
    expect(
      publishVideoSchema.safeParse({
        ...base,
        tags: "x".repeat(MAX_PUBLICATION_TAG_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown visibility", () => {
    expect(
      publishVideoSchema.safeParse({ ...base, visibility: "secret" }).success,
    ).toBe(false);
  });

  it("rejects unlisted Facebook Page videos", () => {
    expect(
      publishVideoSchema.safeParse({
        ...base,
        platform: "facebook",
        visibility: "unlisted",
      }).success,
    ).toBe(false);
    expect(
      publishVideoSchema.safeParse({
        ...base,
        platform: "facebook",
        visibility: "public",
      }).success,
    ).toBe(true);
  });

  it("never defaults to public — visibility must be stated explicitly", () => {
    const withoutVisibility = { ...base };
    delete (withoutVisibility as Partial<typeof base>).visibility;
    expect(publishVideoSchema.safeParse(withoutVisibility).success).toBe(false);
  });

  it("accepts Instagram caption metadata and coerces share-to-feed", () => {
    const result = publishVideoSchema.safeParse({
      projectId: base.projectId,
      renderId: base.renderId,
      connectionId: base.connectionId,
      platform: "instagram",
      caption: "A vertical story #vcstudio",
      shareToFeed: "true",
      visibility: "public",
      requestNonce: base.requestNonce,
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.platform === "instagram")
      expect(result.data.shareToFeed).toBe(true);
  });

  it("rejects invalid Instagram visibility and oversized captions", () => {
    const instagram = {
      projectId: base.projectId,
      renderId: base.renderId,
      connectionId: base.connectionId,
      platform: "instagram",
      shareToFeed: "false",
      visibility: "public",
      requestNonce: base.requestNonce,
    };
    expect(
      publishVideoSchema.safeParse({ ...instagram, caption: "x".repeat(2201) })
        .success,
    ).toBe(false);
    expect(
      publishVideoSchema.safeParse({
        ...instagram,
        caption: "Reel",
        visibility: "private",
      }).success,
    ).toBe(false);
  });
});
