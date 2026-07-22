import { describe, expect, it } from "vitest";
import {
  composeHashtagCaption,
  createPublishingMetadataDraftMap,
  createPublishingMetadataSignatures,
  hydrateUntouchedPublishingMetadata,
  normalizeGeneratedTags,
  selectPreferredGeneratedTitle,
} from "@/lib/publishing/generated-metadata";

describe("generated publishing metadata", () => {
  it("prefers a favorite title and otherwise respects rank", () => {
    const suggestions = [
      { text: "First ranked", position: 0, isFavorite: false },
      { text: "Chosen favorite", position: 2, isFavorite: true },
      { text: "Second ranked", position: 1, isFavorite: false },
    ];
    expect(selectPreferredGeneratedTitle(suggestions)).toBe("Chosen favorite");
    expect(
      selectPreferredGeneratedTitle(
        suggestions.map((entry) => ({ ...entry, isFavorite: false })),
      ),
    ).toBe("First ranked");
  });

  it("normalizes, deduplicates, and bounds generated tags", () => {
    expect(
      normalizeGeneratedTags([
        "#MoneyTips",
        "moneytips",
        "  debt   strategy ",
        "x".repeat(31),
      ]),
    ).toEqual(["MoneyTips", "debt strategy"]);
  });

  it("creates separate drafts per platform and composes hashtags", () => {
    const drafts = createPublishingMetadataDraftMap([
      {
        generationRunId: "run-id",
        platform: "instagram",
        title: "A smarter debt strategy",
        description: "Debt is a tool, not a shortcut.",
        tags: ["Money Tips", "DebtStrategy"],
      },
    ]);
    expect(drafts.youtube).toEqual({ title: "", description: "", tags: "" });
    expect(composeHashtagCaption(drafts.instagram)).toBe(
      "Debt is a tool, not a shortcut.\n\n#MoneyTips #DebtStrategy",
    );
  });

  it("loads every field from a new generation even when stale fields were touched", () => {
    const original = {
      generationRunId: "run-1",
      platform: "youtube" as const,
      title: "Original title",
      description: "Original description",
      tags: ["original"],
    };
    const drafts = createPublishingMetadataDraftMap([original]);
    drafts.facebook = {
      title: "Stale Facebook title",
      description: "",
      tags: "",
    };
    const generatedMetadata = [
      { ...original, generationRunId: "run-2", title: "New YouTube title" },
      {
        ...original,
        generationRunId: "run-3",
        platform: "facebook" as const,
        title: "New Facebook title",
      },
    ];
    const hydrated = hydrateUntouchedPublishingMetadata({
      drafts,
      generatedMetadata,
      touchedPlatforms: new Set(["youtube" as const, "facebook" as const]),
      hydratedSignatures: createPublishingMetadataSignatures([original]),
    });

    expect(hydrated.drafts.youtube.title).toBe("New YouTube title");
    expect(hydrated.drafts.facebook).toEqual({
      title: "New Facebook title",
      description: "Original description",
      tags: "original",
    });
  });

  it("preserves edits when the preferred title changes within the same run", () => {
    const original = {
      generationRunId: "run-1",
      platform: "youtube" as const,
      title: "Original title",
      description: "Original description",
      tags: ["original"],
    };
    const drafts = createPublishingMetadataDraftMap([original]);
    drafts.youtube = {
      title: "User-edited title",
      description: "User-edited description",
      tags: "edited",
    };

    const hydrated = hydrateUntouchedPublishingMetadata({
      drafts,
      generatedMetadata: [{ ...original, title: "New favorite title" }],
      touchedPlatforms: new Set(["youtube" as const]),
      hydratedSignatures: createPublishingMetadataSignatures([original]),
    });

    expect(hydrated.drafts.youtube).toEqual({
      title: "User-edited title",
      description: "User-edited description",
      tags: "edited",
    });
  });
});
