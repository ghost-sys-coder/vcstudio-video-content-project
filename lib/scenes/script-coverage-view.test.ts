import { describe, expect, it } from "vitest";
import { buildScriptCoverageView } from "@/lib/scenes/script-coverage-view";

const SCRIPT = "First passage. Second passage. Third passage.";

describe("buildScriptCoverageView", () => {
  it("reports full coverage for a faithful plan", () => {
    const view = buildScriptCoverageView({
      approvedScript: SCRIPT,
      scriptVersionNumber: 3,
      sceneNarrations: ["First passage.", "Second passage.", "Third passage."],
    });
    expect(view.status).toBe("covered");
    expect(view.coveragePercent).toBe(100);
    expect(view.scriptVersionNumber).toBe(3);
    expect(view.sceneCount).toBe(3);
    expect(view.discrepancies).toHaveLength(0);
    expect(view.scenes.every((scene) => !scene.divergent)).toBe(true);
  });

  it("marks the scene where coverage broke down", () => {
    const view = buildScriptCoverageView({
      approvedScript: SCRIPT,
      scriptVersionNumber: 1,
      sceneNarrations: [
        "First passage.",
        "Something invented.",
        "Third passage.",
      ],
    });
    expect(view.status).toBe("diverged");
    expect(view.discrepancies).toHaveLength(1);
    expect(view.scenes[1]?.divergent).toBe(true);
    expect(view.scenes[0]?.divergent).toBe(false);
    expect(view.coveragePercent).toBeLessThan(100);
  });

  it("reports partial coverage as a percentage", () => {
    const view = buildScriptCoverageView({
      approvedScript: SCRIPT,
      scriptVersionNumber: 1,
      sceneNarrations: ["First passage."],
    });
    expect(view.status).toBe("diverged");
    expect(view.coveredCharacters).toBeGreaterThan(0);
    expect(view.coveragePercent).toBeGreaterThan(0);
    expect(view.coveragePercent).toBeLessThan(100);
  });

  it("handles a project with no approved script", () => {
    const view = buildScriptCoverageView({
      approvedScript: null,
      scriptVersionNumber: null,
      sceneNarrations: [],
    });
    expect(view.status).toBe("no_script");
    expect(view.coveragePercent).toBe(0);
  });

  it("handles an approved script with no scenes yet", () => {
    const view = buildScriptCoverageView({
      approvedScript: SCRIPT,
      scriptVersionNumber: 2,
      sceneNarrations: [],
    });
    expect(view.status).toBe("no_scenes");
    expect(view.sceneCount).toBe(0);
  });

  it("truncates long narration previews", () => {
    const long = `${"word ".repeat(80)}end.`;
    const view = buildScriptCoverageView({
      approvedScript: long,
      scriptVersionNumber: 1,
      sceneNarrations: [long],
    });
    expect(view.status).toBe("covered");
    expect(view.scenes[0]?.narrationPreview.endsWith("…")).toBe(true);
    expect(view.scenes[0]?.narrationPreview.length).toBeLessThanOrEqual(161);
  });

  it("normalizes whitespace in previews without changing wording", () => {
    const view = buildScriptCoverageView({
      approvedScript: "First passage.",
      scriptVersionNumber: 1,
      sceneNarrations: ["  First\n\npassage.  "],
    });
    expect(view.scenes[0]?.narrationPreview).toBe("First passage.");
  });
});
