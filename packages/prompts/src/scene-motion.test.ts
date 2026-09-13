import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  renderSceneMotionPrompt,
  SCENE_MOTION_PROMPT_TEMPLATE_SOURCE,
  SCENE_MOTION_PROMPT_TEMPLATE_SOURCE_HASH,
  SCENE_MOTION_PROMPT_VERSION,
} from "./scene-motion";

function prompt(
  overrides: Partial<Parameters<typeof renderSceneMotionPrompt>[0]> = {},
) {
  return renderSceneMotionPrompt({
    motionDescription: "the chart bars rise one after another",
    visualStyleSummary: "flat 2D vector illustration, limited palette",
    durationSeconds: 5,
    loops: true,
    ...overrides,
  });
}

describe("holding the approved frame still while only motion is added", () => {
  it("treats the supplied image as already correct", () => {
    expect(prompt()).toContain("already correct");
  });

  it("forbids reinterpreting anything that is already in the frame", () => {
    // The approved still carries the workspace style, the characters and the
    // composition. A model allowed to reinterpret throws all of that away.
    const text = prompt();
    expect(text).toContain("Do not redraw, replace, restyle, or reinterpret");
    expect(text).toContain("Do not introduce new subjects");
  });

  it("forbids drifting towards the glossy look that reads as machine-made", () => {
    expect(prompt()).toContain("more cinematic than the supplied frame");
  });

  it("forbids a cut, because the clip is one take", () => {
    expect(prompt()).toContain("one continuous take");
  });

  it("carries the creator's own description of the motion", () => {
    expect(prompt()).toContain("the chart bars rise one after another");
  });

  it("asks for ambient motion when nothing was described", () => {
    // An empty description must not become an empty instruction, or the model
    // fills the silence with invention.
    const text = prompt({ motionDescription: "   " });
    expect(text).toContain("gentle ambient motion");
  });
});

describe("motion that survives being repeated", () => {
  it("asks for a seamless seam when the clip will loop", () => {
    // A jump every few seconds is more distracting than a still image.
    const text = prompt({ loops: true });
    expect(text).toContain("end the motion where it began");
  });

  it("says nothing about looping when the clip plays once", () => {
    const text = prompt({ loops: false });
    expect(text).not.toContain("end the motion where it began");
  });

  it("tells the model how long it is animating for", () => {
    expect(prompt({ durationSeconds: 8 })).toContain("8 seconds");
  });
});

describe("the register this is written for", () => {
  it("names restraint as correct, since this sits under a voiceover", () => {
    expect(prompt()).toContain("Restraint is correct");
  });

  it("still forbids restyling when no style summary was supplied", () => {
    const text = prompt({ visualStyleSummary: "" });
    expect(text).toContain("Hold the existing visual style exactly");
  });
});

describe("version pinning", () => {
  it("carries a source hash that matches its source", () => {
    expect(
      createHash("sha256")
        .update(SCENE_MOTION_PROMPT_TEMPLATE_SOURCE, "utf8")
        .digest("hex"),
    ).toBe(SCENE_MOTION_PROMPT_TEMPLATE_SOURCE_HASH);
  });

  it("is v1", () => {
    expect(SCENE_MOTION_PROMPT_VERSION).toBe("scene-motion-v1");
  });
});
