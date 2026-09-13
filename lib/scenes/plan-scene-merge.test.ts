import { describe, expect, it } from "vitest";
import {
  joinSceneNarration,
  planSceneMerge,
  type SceneMergeSide,
} from "@/lib/scenes/plan-scene-merge";
import { checkNarrationCoverage } from "@/lib/domain/narration-coverage";

function side(overrides: Partial<SceneMergeSide> & { sceneNumber: number }) {
  return {
    sceneId: `scene-${overrides.sceneNumber}`,
    currentVersion: 1,
    narrationText: `Passage ${overrides.sceneNumber}.`,
    estimatedDurationMilliseconds: 4_000,
    startTimeMilliseconds: (overrides.sceneNumber - 1) * 4_000,
    ...overrides,
  } satisfies SceneMergeSide;
}

function plan(survivorNumber: number, absorbedNumber: number) {
  return planSceneMerge({
    survivor: side({ sceneNumber: survivorNumber }),
    absorbed: side({ sceneNumber: absorbedNumber }),
  });
}

describe("planSceneMerge", () => {
  it("refuses scenes that are not neighbours", () => {
    const result = plan(2, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_adjacent");
  });

  it("refuses merging a scene into itself", () => {
    const one = side({ sceneNumber: 3 });
    const result = planSceneMerge({ survivor: one, absorbed: one });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("same_scene");
  });

  it("accepts a neighbour in either direction", () => {
    expect(plan(3, 4).ok).toBe(true);
    expect(plan(4, 3).ok).toBe(true);
  });

  // The merged passage has to read in script order whichever scene the creator
  // kept, or the coverage walk sees the script's passages out of order.
  it("orders narration by script position, not by which scene survives", () => {
    const forward = plan(3, 4);
    const backward = plan(4, 3);
    expect(forward.ok && forward.plan.mergedNarrationText).toBe(
      "Passage 3. Passage 4.",
    );
    expect(backward.ok && backward.plan.mergedNarrationText).toBe(
      "Passage 3. Passage 4.",
    );
  });

  it("lands the merged scene on the earlier of the two numbers", () => {
    expect(plan(4, 3).ok && plan(4, 3).ok).toBe(true);
    const backward = plan(4, 3);
    expect(backward.ok && backward.plan.resultingSceneNumber).toBe(3);
    const forward = plan(3, 4);
    expect(forward.ok && forward.plan.resultingSceneNumber).toBe(3);
  });

  it("starts the merged scene where the earlier scene started", () => {
    const backward = plan(4, 3);
    expect(backward.ok && backward.plan.startTimeMilliseconds).toBe(8_000);
  });

  it("adds the two durations", () => {
    const result = planSceneMerge({
      survivor: side({ sceneNumber: 1, estimatedDurationMilliseconds: 3_000 }),
      absorbed: side({ sceneNumber: 2, estimatedDurationMilliseconds: 5_500 }),
    });
    expect(result.ok && result.plan.mergedDurationMilliseconds).toBe(8_500);
  });
});

describe("joinSceneNarration", () => {
  it("separates the passages with the single space coverage expects", () => {
    expect(joinSceneNarration("First.", "Second.")).toBe("First. Second.");
  });

  it("does not double the separator when a passage carries stray whitespace", () => {
    expect(joinSceneNarration("First.\n\n", "  Second.")).toBe(
      "First. Second.",
    );
  });

  it("adds no separator when one side is empty", () => {
    expect(joinSceneNarration("First.", "   ")).toBe("First.");
    expect(joinSceneNarration("", "Second.")).toBe("Second.");
  });
});

// The point of the whole design: a merge of neighbours must leave the approved
// script still covered exactly once and in order. Asserted against the real
// coverage checker rather than by reasoning about it.
describe("merging neighbours keeps the approved script covered", () => {
  const script = "One fish. Two fish. Red fish. Blue fish.";
  const narrations = ["One fish.", "Two fish.", "Red fish.", "Blue fish."];

  it("covers the script before the merge", () => {
    expect(
      checkNarrationCoverage({
        approvedScript: script,
        sceneNarrations: narrations,
      }).ok,
    ).toBe(true);
  });

  it("still covers it after merging the middle pair", () => {
    const result = planSceneMerge({
      survivor: side({ sceneNumber: 2, narrationText: narrations[1]! }),
      absorbed: side({ sceneNumber: 3, narrationText: narrations[2]! }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      checkNarrationCoverage({
        approvedScript: script,
        sceneNarrations: [
          narrations[0]!,
          result.plan.mergedNarrationText,
          narrations[3]!,
        ],
      }).ok,
    ).toBe(true);
  });

  it("still covers it when the later scene is the one kept", () => {
    const result = planSceneMerge({
      survivor: side({ sceneNumber: 3, narrationText: narrations[2]! }),
      absorbed: side({ sceneNumber: 2, narrationText: narrations[1]! }),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(
      checkNarrationCoverage({
        approvedScript: script,
        sceneNarrations: [
          narrations[0]!,
          result.plan.mergedNarrationText,
          narrations[3]!,
        ],
      }).ok,
    ).toBe(true);
  });
});
