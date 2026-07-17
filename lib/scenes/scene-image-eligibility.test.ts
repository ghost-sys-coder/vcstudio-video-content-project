import { describe, expect, it } from "vitest";
import {
  classifySceneBulkEligibility,
  isSceneDefaultGenerateAll,
  isSceneRetryable,
  isSceneSelectableForBulk,
} from "@/lib/scenes/scene-image-eligibility";

describe("classifySceneBulkEligibility", () => {
  it("marks approved scenes without images as eligible", () => {
    expect(
      classifySceneBulkEligibility({
        sceneStatus: "approved",
        hasApprovedImage: false,
        latestGenerationStatus: null,
      }),
    ).toBe("eligible");
  });

  it("marks unapproved scenes as notApproved", () => {
    expect(
      classifySceneBulkEligibility({
        sceneStatus: "draft",
        hasApprovedImage: false,
        latestGenerationStatus: null,
      }),
    ).toBe("notApproved");
  });

  it("marks scenes with an active generation as inProgress", () => {
    expect(
      classifySceneBulkEligibility({
        sceneStatus: "approved",
        hasApprovedImage: false,
        latestGenerationStatus: "running",
      }),
    ).toBe("inProgress");
  });

  it("marks approved scenes with an approved image distinctly", () => {
    expect(
      classifySceneBulkEligibility({
        sceneStatus: "approved",
        hasApprovedImage: true,
        latestGenerationStatus: "succeeded",
      }),
    ).toBe("hasApprovedImage");
  });

  it("treats a failed latest generation as eligible to select", () => {
    expect(
      classifySceneBulkEligibility({
        sceneStatus: "approved",
        hasApprovedImage: false,
        latestGenerationStatus: "failed",
      }),
    ).toBe("eligible");
  });
});

describe("bulk selection helpers", () => {
  it("allows selecting eligible and already-approved scenes", () => {
    expect(isSceneSelectableForBulk("eligible")).toBe(true);
    expect(isSceneSelectableForBulk("hasApprovedImage")).toBe(true);
    expect(isSceneSelectableForBulk("inProgress")).toBe(false);
    expect(isSceneSelectableForBulk("notApproved")).toBe(false);
  });

  it("only defaults to fresh eligible scenes for generate-all", () => {
    expect(isSceneDefaultGenerateAll("eligible")).toBe(true);
    expect(isSceneDefaultGenerateAll("hasApprovedImage")).toBe(false);
  });
});

describe("isSceneRetryable", () => {
  it("is retryable when approved and the latest generation failed", () => {
    expect(
      isSceneRetryable({
        sceneStatus: "approved",
        latestGenerationStatus: "failed",
      }),
    ).toBe(true);
  });

  it("is not retryable for succeeded or active generations", () => {
    expect(
      isSceneRetryable({
        sceneStatus: "approved",
        latestGenerationStatus: "succeeded",
      }),
    ).toBe(false);
    expect(
      isSceneRetryable({
        sceneStatus: "approved",
        latestGenerationStatus: "running",
      }),
    ).toBe(false);
  });
});
