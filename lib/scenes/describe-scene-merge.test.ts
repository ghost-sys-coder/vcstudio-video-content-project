import { describe, expect, it } from "vitest";
import {
  describeSceneMerge,
  type SceneMergeDescription,
} from "@/lib/scenes/describe-scene-merge";

function summary(overrides: Partial<SceneMergeDescription> = {}) {
  return describeSceneMerge({
    survivorSceneNumber: 3,
    absorbedSceneNumber: 4,
    absorbedHasGeneratedWork: true,
    survivorHasApprovedImages: true,
    totalSceneCount: 7,
    ...overrides,
  });
}

function text(overrides: Partial<SceneMergeDescription> = {}) {
  return summary(overrides)
    .lines.map((line) => line.text)
    .join(" ");
}

describe("describeSceneMerge", () => {
  it("names which scene is absorbed into which", () => {
    expect(summary().title).toBe("Merge scene 4 into scene 3?");
    expect(
      summary({ survivorSceneNumber: 4, absorbedSceneNumber: 3 }).title,
    ).toBe("Merge scene 3 into scene 4?");
  });

  // The narration joins in script order whichever scene is kept, so the wording
  // must not imply the surviving scene's passage comes first.
  it("states the joining order by script position, not by survivor", () => {
    expect(text({ survivorSceneNumber: 4, absorbedSceneNumber: 3 })).toContain(
      "Scene 3's narration and scene 4's are joined in that order",
    );
  });

  it("says the merged scene takes the earlier number either way", () => {
    expect(text({ survivorSceneNumber: 4, absorbedSceneNumber: 3 })).toContain(
      "becomes scene 3",
    );
    expect(text({ survivorSceneNumber: 3, absorbedSceneNumber: 4 })).toContain(
      "becomes scene 3",
    );
  });

  // The whole point of the design is that the survivor's images are free. If the
  // wording ever stops saying so, the feature looks more expensive than it is.
  it("promises the surviving scene keeps its images", () => {
    expect(text({ survivorHasApprovedImages: true })).toContain(
      "approved image for each size is kept",
    );
  });

  it("does not promise kept images when there are none", () => {
    expect(text({ survivorHasApprovedImages: false })).not.toContain(
      "approved image for each size is kept",
    );
  });

  it("warns that the absorbed scene's paid work is destroyed", () => {
    const caution = summary()
      .lines.filter((line) => line.tone === "caution")
      .map((line) => line.text)
      .join(" ");
    expect(caution).toContain("paid for");
  });

  it("does not claim paid work is lost when the absorbed scene has none", () => {
    expect(text({ absorbedHasGeneratedWork: false })).not.toContain("paid for");
  });

  // Unavoidable and non-obvious, so it is stated on every merge rather than
  // only when narration audio happens to exist.
  it("always says both narration takes are lost", () => {
    expect(text({ absorbedHasGeneratedWork: false })).toContain(
      "Narration audio is not kept for either scene",
    );
  });

  it("says the approved script stays covered", () => {
    expect(text()).toContain("narrated once and in order");
  });

  it("counts the scenes left afterwards", () => {
    expect(text({ totalSceneCount: 7 })).toContain(
      "The project will have 6 scenes afterwards",
    );
  });
});
