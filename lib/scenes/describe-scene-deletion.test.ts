import { describe, expect, it } from "vitest";
import {
  describeSceneDeletion,
  type SceneDeletionInput,
} from "@/lib/scenes/describe-scene-deletion";

function summary(overrides: Partial<SceneDeletionInput> = {}) {
  return describeSceneDeletion({
    sceneNumber: 3,
    totalSceneCount: 7,
    hasGeneratedWork: true,
    coversApprovedScript: true,
    ...overrides,
  });
}

describe("saying what the renumbering will do", () => {
  it("names the scene that takes this one's number", () => {
    // Abstract renumbering is hard to picture; a concrete swap is not.
    expect(summary().lines[0]?.text).toContain("scene 4 becomes scene 3");
  });

  it("says nothing about renumbering when deleting the last scene", () => {
    const described = summary({ sceneNumber: 7, totalSceneCount: 7 });
    expect(
      described.lines.some((line) => line.text.includes("renumbered")),
    ).toBe(false);
  });

  it("counts what remains", () => {
    expect(
      summary().lines.some((line) => line.text.includes("6 scenes afterwards")),
    ).toBe(true);
  });

  it("says plainly when nothing will be left", () => {
    const described = summary({ sceneNumber: 1, totalSceneCount: 1 });
    expect(
      described.lines.some((line) => line.text.includes("none left")),
    ).toBe(true);
  });
});

describe("naming the paid work that goes with it", () => {
  it("says it cannot be recovered, without claiming a count it cannot know", () => {
    const described = summary({ hasGeneratedWork: true });
    const caution = described.lines.find((line) => line.tone === "caution");
    expect(caution?.text).toContain("images");
    expect(caution?.text).toContain("narration audio");
    expect(caution?.text).toContain("cannot be recovered");
  });

  it("says nothing about paid work when there is none", () => {
    // A warning that always fires is one nobody reads.
    const described = summary({
      hasGeneratedWork: false,
      coversApprovedScript: false,
    });
    expect(described.lines.some((line) => line.tone === "caution")).toBe(false);
  });
});

describe("the consequence nobody expects", () => {
  it("warns that the script passage becomes uncovered", () => {
    // The scenes exist to reproduce the approved script. Removing one leaves a
    // passage no scene narrates, and hiding that would be worse than saying it.
    const described = summary({ coversApprovedScript: true });
    expect(
      described.lines.some((line) =>
        line.text.includes("no longer be covered"),
      ),
    ).toBe(true);
  });

  it("promises the approved script itself is not edited", () => {
    // The alternative to the warning is rewriting their script for them.
    const described = summary({ coversApprovedScript: true });
    expect(
      described.lines.some((line) =>
        line.text.includes("approved script is not changed"),
      ),
    ).toBe(true);
  });

  it("stays quiet when the project has no approved script to uncover", () => {
    expect(
      summary({ coversApprovedScript: false }).lines.some((line) =>
        line.text.includes("no longer be covered"),
      ),
    ).toBe(false);
  });
});

describe("the dialog itself", () => {
  it("names the scene in the question", () => {
    expect(summary({ sceneNumber: 5 }).title).toBe("Delete scene 5?");
  });

  it("refuses when there is nothing to delete", () => {
    expect(summary({ totalSceneCount: 0 }).canDelete).toBe(false);
  });
});
