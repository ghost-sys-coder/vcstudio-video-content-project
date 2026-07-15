import { describe, expect, it } from "vitest";
import { calculateSceneTimings } from "@/lib/domain/scene-timing";
import type { SceneContent } from "@/lib/schemas/scene";

const base: SceneContent = {
  narrationText: "Text",
  visualDescription: "Visual",
  locationDescription: "Place",
  actionDescription: "Action",
  cameraShot: "wide",
  cameraAngle: "eye",
  cameraMotion: "pan",
  emotionalTone: "calm",
  characterNames: [],
  propNames: [],
  continuityNotes: "",
  estimatedDurationMilliseconds: 2000,
};

describe("calculateSceneTimings", () => {
  it("creates contiguous ordered timings", () => {
    const result = calculateSceneTimings(
      [base, { ...base, estimatedDurationMilliseconds: 3000 }],
      { minimum: 1000, maximum: 60000 },
    );
    expect(
      result.map(({ startTimeMilliseconds, endTimeMilliseconds }) => [
        startTimeMilliseconds,
        endTimeMilliseconds,
      ]),
    ).toEqual([
      [0, 2000],
      [2000, 5000],
    ]);
  });
  it("clamps duration limits", () => {
    const result = calculateSceneTimings(
      [{ ...base, estimatedDurationMilliseconds: 100 }],
      { minimum: 1000, maximum: 60000 },
    );
    expect(result[0]?.estimatedDurationMilliseconds).toBe(1000);
  });
});
