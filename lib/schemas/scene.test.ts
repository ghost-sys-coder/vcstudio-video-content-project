import { describe, expect, it } from "vitest";
import { sceneAnalysisOutputSchema } from "@/lib/schemas/scene";

const scene = {
  narrationText: "A new day begins.",
  visualDescription: "Sunrise over a quiet city.",
  locationDescription: "City skyline",
  actionDescription: "Light moves across rooftops",
  cameraShot: "wide",
  cameraAngle: "eye level",
  cameraMotion: "slow pan",
  emotionalTone: "hopeful",
  characterNames: [],
  propNames: [],
  continuityNotes: "",
  estimatedDurationMilliseconds: 4000,
};

describe("sceneAnalysisOutputSchema", () => {
  it("accepts structured scenes", () =>
    expect(
      sceneAnalysisOutputSchema.parse({ scenes: [scene] }).scenes,
    ).toHaveLength(1));
  it("rejects empty responses", () =>
    expect(sceneAnalysisOutputSchema.safeParse({ scenes: [] }).success).toBe(
      false,
    ));
  it("rejects invalid durations", () =>
    expect(
      sceneAnalysisOutputSchema.safeParse({
        scenes: [{ ...scene, estimatedDurationMilliseconds: 0 }],
      }).success,
    ).toBe(false));
});
