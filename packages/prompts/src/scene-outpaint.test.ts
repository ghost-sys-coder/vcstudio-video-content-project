import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  renderSceneOutpaintPrompt,
  SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE,
  SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE_HASH,
  SCENE_OUTPAINT_PROMPT_VERSION,
} from "./scene-outpaint";

/** The real 9:16 case: a 2:3 canvas cover-fitted into a 9:16 frame. */
function verticalPrompt() {
  return renderSceneOutpaintPrompt({
    aspectRatio: "9:16",
    frameWidth: 1080,
    frameHeight: 1920,
    canvasWidth: 1024,
    canvasHeight: 1536,
    safeArea: {
      croppedAxis: "width",
      visibleWidthBps: 8438,
      visibleHeightBps: 10_000,
      trimmedPerEdgeBps: 781,
    },
  });
}

describe("telling the model the canvas it will actually produce", () => {
  it("names the produced canvas, not the video frame", () => {
    // v1's defect in one line: it said "9:16, 1080x1920" when the provider
    // returns 1024x1536, so the model composed for a frame it never filled.
    const prompt = verticalPrompt();
    expect(prompt).toContain("1024x1536");
    expect(prompt).not.toContain("Target composition: 9:16, 1080x1920");
  });

  it("warns that a crop follows and names the safe area", () => {
    const prompt = verticalPrompt();
    expect(prompt).toContain("centre-cropped");
    expect(prompt).toContain("84.4% of its width");
  });

  it("asks for background, not subjects, in the part that gets discarded", () => {
    const prompt = verticalPrompt();
    expect(prompt).toContain("7.8% of the width on each side as bleed");
    expect(prompt).toContain("only background there");
  });

  it("keeps the guarantees that made the outpaint safe in the first place", () => {
    const prompt = verticalPrompt();
    expect(prompt).toContain("without changing its existing content");
    expect(prompt).toContain("Do not add text");
  });
});

describe("the other shapes", () => {
  it("speaks of the top and bottom when height is what gets cropped", () => {
    const prompt = renderSceneOutpaintPrompt({
      aspectRatio: "16:9",
      frameWidth: 1920,
      frameHeight: 1080,
      canvasWidth: 1536,
      canvasHeight: 1024,
      safeArea: {
        croppedAxis: "height",
        visibleWidthBps: 10_000,
        visibleHeightBps: 8438,
        trimmedPerEdgeBps: 781,
      },
    });
    expect(prompt).toContain("84.4% of its height");
    expect(prompt).toContain("top and bottom");
  });

  it("promises no crop when the canvas already matches the frame", () => {
    // Square is the one shape the provider gets exactly right, and inventing a
    // safe area there would waste the model's attention on nothing.
    const prompt = renderSceneOutpaintPrompt({
      aspectRatio: "1:1",
      frameWidth: 1080,
      frameHeight: 1080,
      canvasWidth: 1024,
      canvasHeight: 1024,
      safeArea: {
        croppedAxis: "none",
        visibleWidthBps: 10_000,
        visibleHeightBps: 10_000,
        trimmedPerEdgeBps: 0,
      },
    });
    expect(prompt).toContain("no cropping");
    expect(prompt).not.toContain("bleed");
  });
});

describe("version pinning", () => {
  it("is v2, because v1 generations must stay reproducible", () => {
    expect(SCENE_OUTPAINT_PROMPT_VERSION).toBe("scene-outpaint-v2");
  });

  it("carries a source hash that matches its source", () => {
    // The hash gates the worker against the template it was built with, so a
    // source edited without rehashing would fail every generation.
    expect(
      createHash("sha256")
        .update(SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE, "utf8")
        .digest("hex"),
    ).toBe(SCENE_OUTPAINT_PROMPT_TEMPLATE_SOURCE_HASH);
  });
});
