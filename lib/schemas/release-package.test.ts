import { describe, expect, it } from "vitest";
import {
  parseReleaseTags,
  saveReleasePackageSchema,
} from "@/lib/schemas/release-package";

const valid = {
  projectId: "11111111-1111-4111-8111-111111111111",
  outputVariantId: "22222222-2222-4222-8222-222222222222",
  platform: "youtube",
  channelProfileId: null,
  expectedRevision: null,
  title: "A title",
  titleSuggestionId: null,
  description: "A description",
  tags: ["money"],
  visibility: "private",
  thumbnailGenerationId: null,
  caption: null,
  shareToFeed: null,
  plannedReleaseAt: null,
};

describe("saveReleasePackageSchema", () => {
  it("accepts a complete package", () => {
    expect(saveReleasePackageSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a package that is only being planned", () => {
    // Title and thumbnail can be planned before anything is rendered, so an
    // empty title has to save. Refusing to dispatch is a separate decision.
    expect(
      saveReleasePackageSchema.safeParse({ ...valid, title: "" }).success,
    ).toBe(true);
  });

  it("refuses a title longer than the column allows", () => {
    // Mirrors release_packages_title_bounded, so an over-long title is a
    // readable message rather than a constraint violation.
    expect(
      saveReleasePackageSchema.safeParse({ ...valid, title: "x".repeat(301) })
        .success,
    ).toBe(false);
  });

  it("refuses a description longer than the column allows", () => {
    expect(
      saveReleasePackageSchema.safeParse({
        ...valid,
        description: "x".repeat(10_001),
      }).success,
    ).toBe(false);
  });

  it("refuses a platform the video pipeline does not publish to", () => {
    expect(
      saveReleasePackageSchema.safeParse({ ...valid, platform: "linkedin" })
        .success,
    ).toBe(false);
  });

  it("refuses a revision of zero, which no row can have", () => {
    expect(
      saveReleasePackageSchema.safeParse({ ...valid, expectedRevision: 0 })
        .success,
    ).toBe(false);
  });

  it("caps the number of tags rather than storing an unbounded list", () => {
    expect(
      saveReleasePackageSchema.safeParse({
        ...valid,
        tags: Array.from({ length: 31 }, (_, index) => `tag${index}`),
      }).success,
    ).toBe(false);
  });
});

describe("parseReleaseTags", () => {
  it("splits, trims and drops the hash a creator types", () => {
    expect(parseReleaseTags(" #money , budget ,  ")).toEqual([
      "money",
      "budget",
    ]);
  });

  it("removes duplicates regardless of case", () => {
    expect(parseReleaseTags("Money, money, MONEY")).toEqual(["Money"]);
  });

  it("collapses runs of whitespace inside a tag", () => {
    expect(parseReleaseTags("personal   finance")).toEqual([
      "personal finance",
    ]);
  });

  it("stops at the cap the schema enforces", () => {
    const many = Array.from({ length: 40 }, (_, index) => `tag${index}`).join(
      ",",
    );
    expect(parseReleaseTags(many)).toHaveLength(30);
  });

  it("returns nothing for an empty field", () => {
    expect(parseReleaseTags("   ")).toEqual([]);
  });
});
