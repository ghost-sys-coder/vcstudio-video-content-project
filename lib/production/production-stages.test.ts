import { describe, expect, it } from "vitest";
import {
  PRODUCTION_RESOURCES,
  PRODUCTION_STAGE_ORDER,
  describeStageProgress,
} from "@/lib/production/production-stages";
import { PROJECT_STAGE_SEGMENTS } from "@/lib/production/project-tab";

describe("describeStageProgress", () => {
  it("marks exactly one stage as current", () => {
    for (const stage of PRODUCTION_STAGE_ORDER) {
      const current = describeStageProgress(stage).filter(
        (step) => step.state === "current",
      );
      expect(current).toHaveLength(1);
      expect(current[0]?.stage).toBe(stage);
    }
  });

  it("marks earlier stages done and later ones upcoming", () => {
    const steps = describeStageProgress("audio");
    const state = (stage: string) =>
      steps.find((step) => step.stage === stage)?.state;
    expect(state("script")).toBe("done");
    expect(state("scenes")).toBe("done");
    expect(state("storyboard")).toBe("done");
    expect(state("audio")).toBe("current");
    expect(state("render")).toBe("upcoming");
    expect(state("release")).toBe("upcoming");
  });

  it("shows nothing as done at the very start", () => {
    const steps = describeStageProgress("script");
    expect(steps.filter((step) => step.state === "done")).toHaveLength(0);
  });

  it("shows everything but the last as done at release", () => {
    const steps = describeStageProgress("release");
    expect(steps.filter((step) => step.state === "upcoming")).toHaveLength(0);
    expect(steps.filter((step) => step.state === "done")).toHaveLength(
      PRODUCTION_STAGE_ORDER.length - 1,
    );
  });

  it("points every stage at a real project tab", () => {
    // A dead progress link would strand the creator, which is the opposite of
    // what this navigation is for.
    for (const step of describeStageProgress("script"))
      expect(PROJECT_STAGE_SEGMENTS).toContain(step.href);
  });
});

describe("reusable resources", () => {
  it("points outside the project, since they are workspace resources", () => {
    for (const resource of PRODUCTION_RESOURCES) {
      expect(resource.href.startsWith("/app/")).toBe(true);
      expect(resource.href).not.toContain("/projects/");
    }
  });
});
