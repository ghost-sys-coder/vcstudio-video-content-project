import { describe, expect, it } from "vitest";
import {
  describeReframeProgress,
  type ReframeProgressInput,
} from "@/lib/reframe/reframe-progress";

function progress(overrides: Partial<ReframeProgressInput> = {}) {
  return describeReframeProgress({
    status: "extending",
    totalExtensions: 10,
    succeededExtensions: 0,
    failedExtensions: 0,
    renderPercent: null,
    ...overrides,
  });
}

describe("while images are being extended", () => {
  it("counts what is done against what was started", () => {
    expect(progress({ succeededExtensions: 4 }).detail).toBe("4 of 10 done");
  });

  it("measures the bar by how many are resolved, not by feel", () => {
    expect(progress({ succeededExtensions: 4 }).percent).toBe(40);
  });

  it("counts a failure as resolved, because it is no longer being waited on", () => {
    const result = progress({ succeededExtensions: 4, failedExtensions: 1 });
    expect(result.percent).toBe(50);
  });

  it("says how many could not be extended rather than hiding them in the count", () => {
    const result = progress({ succeededExtensions: 4, failedExtensions: 1 });
    expect(result.detail).toContain("1 could not be extended");
  });

  it("shows no bar when there is nothing to extend", () => {
    const result = progress({ totalExtensions: 0 });
    expect(result.percent).toBeNull();
    expect(result.label).toBe("Preparing");
  });

  it("reaches a hundred only when every extension is resolved", () => {
    expect(progress({ succeededExtensions: 10 }).percent).toBe(100);
    expect(progress({ succeededExtensions: 9 }).percent).toBe(90);
  });
});

describe("while the video renders", () => {
  it("reports the render's own measurement", () => {
    const result = progress({
      status: "rendering",
      succeededExtensions: 10,
      renderPercent: 35,
    });
    expect(result.label).toBe("Rendering");
    expect(result.percent).toBe(35);
  });

  it("shows nothing rather than a guess before the render reports", () => {
    const result = progress({ status: "rendering", renderPercent: null });
    expect(result.percent).toBeNull();
  });

  it("keeps the image count visible, since that work is already paid for", () => {
    const result = progress({
      status: "rendering",
      succeededExtensions: 9,
      failedExtensions: 1,
      renderPercent: 10,
    });
    expect(result.detail).toBe("9 of 10 images extended");
  });
});

describe("what the bar must never do", () => {
  it("never spans both phases with one invented number", () => {
    // Extending ten images and rendering a video take unrelated amounts of
    // time. A single bar across the two would be fiction, and a creator
    // watching it stall at the handover would read that as a fault.
    const extending = progress({ succeededExtensions: 10 });
    const rendering = progress({
      status: "rendering",
      succeededExtensions: 10,
      renderPercent: 0,
    });
    expect(extending.percent).toBe(100);
    expect(rendering.percent).toBe(0);
  });

  it("shows no bar for a job that ended badly", () => {
    expect(progress({ status: "failed" }).percent).toBeNull();
    expect(progress({ status: "cancelled" }).percent).toBeNull();
  });

  it("shows a full bar only when the job actually finished", () => {
    expect(progress({ status: "completed" }).percent).toBe(100);
  });

  it("names every state it can be in", () => {
    for (const status of [
      "extending",
      "rendering",
      "completed",
      "failed",
      "cancelled",
    ] as const)
      expect(progress({ status }).label.trim().length).toBeGreaterThan(0);
  });
});
