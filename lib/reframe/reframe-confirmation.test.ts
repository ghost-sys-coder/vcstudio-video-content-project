import { describe, expect, it } from "vitest";
import {
  describeReframeCancellation,
  describeReframeConfirmation,
  type ReframePlanSummary,
} from "@/lib/reframe/reframe-confirmation";

function summary(
  overrides: Partial<ReframePlanSummary> = {},
): ReframePlanSummary {
  return {
    sceneCount: 10,
    extendCount: 8,
    cropCount: 0,
    readyCount: 2,
    blockedSceneNumbers: [],
    croppedSceneNumbers: [],
    ...overrides,
  };
}

function confirm(
  overrides: Partial<ReframePlanSummary> = {},
  estimatedCostCents = 64,
) {
  return describeReframeConfirmation({
    summary: summary(overrides),
    aspectRatio: "9:16",
    estimatedCostCents,
  });
}

describe("what the dialog commits a person to", () => {
  it("puts the spend in the button, so the click itself states the cost", () => {
    expect(confirm().confirmLabel).toBe("Start and spend $0.64");
  });

  it("does not claim a cost when nothing will be generated", () => {
    const described = confirm({ extendCount: 0, readyCount: 10 }, 0);
    expect(described.confirmLabel).toBe("Start reframe");
    expect(described.lines.some((line) => line.text.includes("$"))).toBe(false);
  });

  it("always says what the money is for, even when it is nothing", () => {
    // The dialog exists to answer "what will this cost", so silence is a wrong
    // answer in both directions.
    const free = confirm({ extendCount: 0 }, 0);
    expect(free.lines.some((line) => line.text.includes("not cost"))).toBe(
      true,
    );
    const paid = confirm();
    expect(
      paid.lines.some((line) => line.text.includes("Estimated cost $0.64")),
    ).toBe(true);
  });

  it("names the shape being made, so two targets never look alike", () => {
    expect(confirm().title).toContain("9:16");
  });
});

describe("refusing rather than failing server side", () => {
  it("will not let a job start while a scene has no approved image", () => {
    const described = confirm({ blockedSceneNumbers: [3, 7] });
    expect(described.canConfirm).toBe(false);
    expect(
      described.lines.some(
        (line) => line.tone === "blocking" && line.text.includes("3, 7"),
      ),
    ).toBe(true);
  });

  it("allows a job whose only problem is a lossy crop", () => {
    const described = confirm({ croppedSceneNumbers: [2] });
    expect(described.canConfirm).toBe(true);
    expect(described.lines.some((line) => line.tone === "caution")).toBe(true);
  });

  it("warns that cropping loses picture rather than describing it neutrally", () => {
    const described = confirm({ croppedSceneNumbers: [2, 5] });
    const caution = described.lines.find((line) => line.tone === "caution");
    expect(caution?.text).toContain("cropped");
    expect(caution?.text).toContain("2, 5");
  });

  it("reads correctly for a single scene", () => {
    const described = confirm({
      sceneCount: 1,
      extendCount: 1,
      readyCount: 0,
      croppedSceneNumbers: [],
    });
    expect(described.lines[0]?.text).toContain("1 of 1 scenes");
    expect(described.lines[0]?.text).not.toContain("their images");
  });
});

describe("stopping a reframe", () => {
  it("promises that finished images are kept, not that the spend is undone", () => {
    const described = describeReframeCancellation("extending");
    expect(described.body).toContain("kept");
    expect(described.body).toContain("reuse");
    expect(described.body).not.toContain("refund");
  });

  it("says something different while rendering, because the loss differs", () => {
    const extending = describeReframeCancellation("extending");
    const rendering = describeReframeCancellation("rendering");
    expect(rendering.title).not.toBe(extending.title);
    expect(rendering.body).toContain("discarded");
  });
});
