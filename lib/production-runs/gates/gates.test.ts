import { describe, expect, it } from "vitest";
import { evaluateAudioGate } from "@/lib/production-runs/gates/audio-gate";
import {
  combineGateResults,
  fail,
  pass,
  warn,
} from "@/lib/production-runs/gates/gate-result";
import { evaluateImageGate } from "@/lib/production-runs/gates/image-gate";
import { evaluateScenePlanGate } from "@/lib/production-runs/gates/scene-plan-gate";
import { evaluateScriptGate } from "@/lib/production-runs/gates/script-gate";

const words = (count: number) =>
  Array.from({ length: count }, () => "word").join(" ");

describe("combineGateResults", () => {
  it("takes the strictest verdict and keeps every reason", () => {
    const combined = combineGateResults([
      pass(["a"], 90),
      warn(["b"], 60),
      fail(["c"]),
    ]);
    expect(combined.verdict).toBe("fail");
    expect(combined.reasons).toEqual(["a", "b", "c"]);
    expect(combined.score).toBe(60);
  });
  it("is a pass when every result passes", () => {
    expect(combineGateResults([pass(), pass()]).verdict).toBe("pass");
  });
});

describe("evaluateScriptGate", () => {
  it("fails an empty script", () => {
    expect(
      evaluateScriptGate({
        content: "  ",
        maximumCharacters: 1000,
        targetDurationSeconds: 60,
      }).verdict,
    ).toBe("fail");
  });
  it("fails a script over the character limit", () => {
    const result = evaluateScriptGate({
      content: words(400),
      maximumCharacters: 100,
      targetDurationSeconds: null,
    });
    expect(result.verdict).toBe("fail");
    expect(result.reasons[0]).toContain("limit");
  });
  it("fails a script that reads in under fifteen seconds", () => {
    expect(
      evaluateScriptGate({
        content: words(10),
        maximumCharacters: 10_000,
        targetDurationSeconds: null,
      }).verdict,
    ).toBe("fail");
  });
  it("passes without a target", () => {
    expect(
      evaluateScriptGate({
        content: words(150),
        maximumCharacters: 10_000,
        targetDurationSeconds: null,
      }).verdict,
    ).toBe("pass");
  });
  it("passes near the target, warns away from it, fails far from it", () => {
    // 150 words is about 60 seconds.
    expect(
      evaluateScriptGate({
        content: words(150),
        maximumCharacters: 10_000,
        targetDurationSeconds: 60,
      }).verdict,
    ).toBe("pass");
    expect(
      evaluateScriptGate({
        content: words(150),
        maximumCharacters: 10_000,
        targetDurationSeconds: 90,
      }).verdict,
    ).toBe("warn");
    expect(
      evaluateScriptGate({
        content: words(150),
        maximumCharacters: 10_000,
        targetDurationSeconds: 300,
      }).verdict,
    ).toBe("fail");
  });
});

describe("evaluateScenePlanGate", () => {
  const scene = (
    n: number,
    overrides: Partial<{
      narrationText: string;
      visualDescription: string;
    }> = {},
  ) => ({
    sceneNumber: n,
    narrationText: "Some narration here.",
    visualDescription: "A desk.",
    ...overrides,
  });
  it("fails an empty plan and an oversized plan", () => {
    expect(
      evaluateScenePlanGate({ scenes: [], maximumScenes: 10 }).verdict,
    ).toBe("fail");
    expect(
      evaluateScenePlanGate({ scenes: [scene(1), scene(2)], maximumScenes: 1 })
        .verdict,
    ).toBe("fail");
  });
  it("fails a scene with no narration or no visual", () => {
    expect(
      evaluateScenePlanGate({
        scenes: [scene(1, { narrationText: " " })],
        maximumScenes: 10,
      }).reasons[0],
    ).toContain("Scene 1 has no narration");
    expect(
      evaluateScenePlanGate({
        scenes: [scene(1, { visualDescription: "" })],
        maximumScenes: 10,
      }).verdict,
    ).toBe("fail");
  });
  it("warns about a very long single-image scene and passes a normal plan", () => {
    expect(
      evaluateScenePlanGate({
        scenes: [scene(1, { narrationText: words(200) })],
        maximumScenes: 10,
      }).verdict,
    ).toBe("warn");
    expect(
      evaluateScenePlanGate({ scenes: [scene(1), scene(2)], maximumScenes: 10 })
        .verdict,
    ).toBe("pass");
  });
});

describe("evaluateImageGate", () => {
  const base = {
    status: "succeeded",
    requestedSize: "1536x1024",
    assetWidth: 1536,
    assetHeight: 1024,
    assetObjectKey: "k",
    safeErrorMessage: null,
  };
  it("passes a stored image of the requested size", () => {
    expect(evaluateImageGate(base).verdict).toBe("pass");
  });
  it("fails a failed generation with its message", () => {
    const result = evaluateImageGate({
      ...base,
      status: "failed",
      safeErrorMessage: "Provider refused.",
    });
    expect(result.verdict).toBe("fail");
    expect(result.reasons[0]).toContain("Provider refused.");
  });
  it("fails a succeeded generation with no file", () => {
    expect(evaluateImageGate({ ...base, assetObjectKey: null }).verdict).toBe(
      "fail",
    );
  });
  it("fails the wrong size and warns when the size is unknown", () => {
    expect(
      evaluateImageGate({ ...base, assetWidth: 1024, assetHeight: 1024 })
        .verdict,
    ).toBe("fail");
    expect(
      evaluateImageGate({ ...base, assetWidth: null, assetHeight: null })
        .verdict,
    ).toBe("warn");
  });
});

describe("evaluateAudioGate", () => {
  // 150 words is about 60 seconds of narration.
  const base = {
    status: "succeeded",
    assetObjectKey: "k",
    durationMilliseconds: 60_000,
    narrationText: words(150),
    safeErrorMessage: null,
    amplitudeEnvelope: null,
  };
  it("passes a clip whose length matches its words", () => {
    expect(evaluateAudioGate(base).verdict).toBe("pass");
  });
  it("fails a missing file or unmeasured duration", () => {
    expect(evaluateAudioGate({ ...base, assetObjectKey: null }).verdict).toBe(
      "fail",
    );
    expect(
      evaluateAudioGate({ ...base, durationMilliseconds: null }).verdict,
    ).toBe("fail");
  });
  it("warns when the length drifts and fails when it is implausible", () => {
    expect(
      evaluateAudioGate({ ...base, durationMilliseconds: 35_000 }).verdict,
    ).toBe("warn");
    expect(
      evaluateAudioGate({ ...base, durationMilliseconds: 5_000 }).verdict,
    ).toBe("fail");
  });
  it("fails a clip that is mostly silence when an envelope was measured", () => {
    const quiet = Array.from({ length: 100 }, (_, i) => (i < 10 ? 0.5 : 0));
    const loud = Array.from({ length: 100 }, () => 0.4);
    expect(
      evaluateAudioGate({ ...base, amplitudeEnvelope: quiet }).verdict,
    ).toBe("fail");
    expect(
      evaluateAudioGate({ ...base, amplitudeEnvelope: loud }).verdict,
    ).toBe("pass");
  });
});
