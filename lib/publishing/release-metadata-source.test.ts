import { describe, expect, it } from "vitest";
import {
  createPublishingDraftsFromPackages,
  hasSavedReleaseMetadata,
} from "@/lib/publishing/release-metadata-source";

const generated = [
  {
    generationRunId: "run-1",
    platform: "youtube" as const,
    title: "Generated title",
    description: "Generated description",
    tags: ["generated"],
  },
];

const savedPackage = {
  platform: "youtube" as const,
  channelProfileId: null,
  title: "Edited title",
  description: "Edited description",
  tags: ["edited", "money"],
};

const empty = {
  platform: "youtube" as const,
  channelProfileId: null,
  title: "",
  description: "",
  tags: [] as string[],
};

describe("what the publish fields open with", () => {
  it("prefers what a person saved over what a model generated", () => {
    // Reopening the page must not discard editing that was already saved.
    const drafts = createPublishingDraftsFromPackages({
      packages: [savedPackage],
      generated,
    });
    expect(drafts.youtube).toEqual({
      title: "Edited title",
      description: "Edited description",
      tags: "edited, money",
    });
  });

  it("falls back to generated text when nothing has been saved", () => {
    const drafts = createPublishingDraftsFromPackages({
      packages: [],
      generated,
    });
    expect(drafts.youtube.title).toBe("Generated title");
  });

  it("does not blank the fields for a package that exists but is empty", () => {
    // Creating a package is not the same as deciding its contents.
    const drafts = createPublishingDraftsFromPackages({
      packages: [empty],
      generated,
    });
    expect(drafts.youtube.title).toBe("Generated title");
  });

  it("keeps one platform's saved copy out of another's", () => {
    const drafts = createPublishingDraftsFromPackages({
      packages: [savedPackage],
      generated,
    });
    expect(drafts.tiktok.title).toBe("");
    expect(drafts.youtube.title).toBe("Edited title");
  });

  it("covers every video platform, saved or not", () => {
    const drafts = createPublishingDraftsFromPackages({
      packages: [],
      generated: [],
    });
    expect(Object.keys(drafts).sort()).toEqual([
      "facebook",
      "instagram",
      "tiktok",
      "youtube",
    ]);
  });

  it("treats a saved package with only tags as a decision", () => {
    const drafts = createPublishingDraftsFromPackages({
      packages: [{ ...empty, tags: ["kept"] }],
      generated,
    });
    expect(drafts.youtube.tags).toBe("kept");
    expect(drafts.youtube.title).toBe("");
  });
});

describe("hasSavedReleaseMetadata", () => {
  it("is false for whitespace, which is not a decision", () => {
    expect(
      hasSavedReleaseMetadata({ title: "  ", description: "\n", tags: [] }),
    ).toBe(false);
  });

  it("is true when any field carries something", () => {
    for (const saved of [
      { title: "x", description: "", tags: [] },
      { title: "", description: "x", tags: [] },
      { title: "", description: "", tags: ["x"] },
    ])
      expect(hasSavedReleaseMetadata(saved)).toBe(true);
  });
});
