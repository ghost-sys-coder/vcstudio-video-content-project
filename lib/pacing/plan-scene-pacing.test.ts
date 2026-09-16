import { describe, expect, it } from "vitest";
import {
  DEFAULT_PACING_PROFILE_ID,
  PACING_PROFILES,
  PACING_PROFILE_IDS,
  isPacingProfileId,
  resolvePacingProfile,
} from "@/lib/pacing/pacing-profile";
import {
  describeScenePacingFit,
  planScenePacing,
  planTargetShotCount,
} from "@/lib/pacing/plan-scene-pacing";
import {
  deriveSceneCameraMotion,
  deriveSceneTransition,
} from "@/lib/render/scene-motion";
import {
  MAX_SHOTS_PER_SCENE,
  MINIMUM_SHOT_DURATION_MILLISECONDS,
} from "@/lib/scenes/shot-timing";

describe("pacing profiles", () => {
  it("resolves every published profile", () => {
    for (const id of PACING_PROFILE_IDS)
      expect(resolvePacingProfile(id).id).toBe(id);
  });

  // A render must never fail because a profile was renamed or a row predates
  // the column, and the default is the historical behaviour.
  it("falls back to the default for an unknown or missing value", () => {
    expect(resolvePacingProfile(null).id).toBe(DEFAULT_PACING_PROFILE_ID);
    expect(resolvePacingProfile("cinematic").id).toBe(
      DEFAULT_PACING_PROFILE_ID,
    );
    expect(resolvePacingProfile("").id).toBe(DEFAULT_PACING_PROFILE_ID);
  });

  it("recognises only the profiles it ships", () => {
    expect(isPacingProfileId("documentary")).toBe(true);
    expect(isPacingProfileId("Documentary")).toBe(false);
    expect(isPacingProfileId("toString")).toBe(false);
  });

  it("orders the profiles from calm to busy", () => {
    expect(PACING_PROFILES.documentary.millisecondsPerShot).toBeGreaterThan(
      PACING_PROFILES.explainer.millisecondsPerShot,
    );
    expect(PACING_PROFILES.explainer.millisecondsPerShot).toBeGreaterThan(
      PACING_PROFILES.short.millisecondsPerShot,
    );
  });
});

// The whole compatibility promise: adopting pacing must not re-cut anybody's
// existing video. The default profile has to reproduce the old derivations
// exactly, scene for scene.
describe("the default profile reproduces the previous behaviour", () => {
  const profile = resolvePacingProfile(null);

  it("picks the same camera move for every scene position", () => {
    for (let sceneNumber = 1; sceneNumber <= 24; sceneNumber++)
      expect(
        planScenePacing({
          profile,
          sceneNumber,
          durationMilliseconds: 10_000,
        }).cameraMotion,
      ).toBe(deriveSceneCameraMotion(sceneNumber));
  });

  it("picks the same transition for every scene position", () => {
    for (let sceneNumber = 1; sceneNumber <= 24; sceneNumber++)
      expect(
        planScenePacing({
          profile,
          sceneNumber,
          durationMilliseconds: 10_000,
        }).transition,
      ).toBe(deriveSceneTransition(sceneNumber));
  });
});

describe("planScenePacing", () => {
  it("opens a documentary by fading in rather than cutting", () => {
    expect(
      planScenePacing({
        profile: PACING_PROFILES.documentary,
        sceneNumber: 1,
        durationMilliseconds: 30_000,
      }).transition,
    ).toBe("fade");
  });

  it("cuts throughout a short, including into the first scene", () => {
    for (const sceneNumber of [1, 2, 7])
      expect(
        planScenePacing({
          profile: PACING_PROFILES.short,
          sceneNumber,
          durationMilliseconds: 6_000,
        }).transition,
      ).toBe("cut");
  });

  it("never pans in a documentary, where a pan would become the subject", () => {
    for (let sceneNumber = 1; sceneNumber <= 12; sceneNumber++)
      expect(
        planScenePacing({
          profile: PACING_PROFILES.documentary,
          sceneNumber,
          durationMilliseconds: 30_000,
        }).cameraMotion,
      ).toMatch(/^zoom/);
  });

  it("holds one steady move through a short", () => {
    const moves = [1, 2, 3, 4, 5].map(
      (sceneNumber) =>
        planScenePacing({
          profile: PACING_PROFILES.short,
          sceneNumber,
          durationMilliseconds: 6_000,
        }).cameraMotion,
    );
    expect(new Set(moves).size).toBe(1);
  });

  it("refuses a scene number that cannot exist", () => {
    expect(() =>
      planScenePacing({
        profile: PACING_PROFILES.short,
        sceneNumber: 0,
        durationMilliseconds: 6_000,
      }),
    ).toThrow(RangeError);
  });
});

describe("planTargetShotCount", () => {
  it("asks for more images from a busier profile, given the same scene", () => {
    const documentary = planTargetShotCount(
      PACING_PROFILES.documentary,
      60_000,
    );
    const explainer = planTargetShotCount(PACING_PROFILES.explainer, 60_000);
    const short = planTargetShotCount(PACING_PROFILES.short, 60_000);
    expect(documentary).toBeLessThan(explainer);
    expect(explainer).toBeLessThan(short);
  });

  // Advice the shot placer would reject is advice that does nothing: it refuses
  // a scene too short to give every image its minimum moment and falls back to
  // a single still.
  it("never asks for more images than the scene can readably show", () => {
    // The floor of one is exempt, matching the placer: a scene shorter than a
    // single readable moment still has to show something, and it holds one
    // still for its whole length rather than showing nothing.
    for (const duration of [1_000, 2_400, 5_000, 9_000]) {
      const target = planTargetShotCount(PACING_PROFILES.short, duration);
      if (target > 1)
        expect(target * MINIMUM_SHOT_DURATION_MILLISECONDS).toBeLessThanOrEqual(
          duration,
        );
    }
  });

  it("asks for a single still when the scene is too short to change image", () => {
    expect(
      planTargetShotCount(
        PACING_PROFILES.short,
        MINIMUM_SHOT_DURATION_MILLISECONDS - 1,
      ),
    ).toBe(1);
  });

  it("never exceeds the renderer's ceiling on a very long scene", () => {
    expect(planTargetShotCount(PACING_PROFILES.short, 30 * 60_000)).toBe(
      MAX_SHOTS_PER_SCENE,
    );
  });

  it("always asks for at least one image", () => {
    expect(planTargetShotCount(PACING_PROFILES.documentary, 500)).toBe(1);
    expect(planTargetShotCount(PACING_PROFILES.short, 0)).toBe(1);
    expect(planTargetShotCount(PACING_PROFILES.short, -5)).toBe(1);
    expect(planTargetShotCount(PACING_PROFILES.short, Number.NaN)).toBe(1);
  });

  it("scales with the scene's own length rather than a fixed count", () => {
    const shortScene = planTargetShotCount(PACING_PROFILES.explainer, 8_000);
    const longScene = planTargetShotCount(PACING_PROFILES.explainer, 40_000);
    expect(longScene).toBeGreaterThan(shortScene);
  });
});

describe("describeScenePacingFit", () => {
  it("reports a scene with fewer images than the pace wants", () => {
    expect(
      describeScenePacingFit({ approvedShotCount: 1, targetShotCount: 3 }),
    ).toBe("sparse");
  });

  it("reports a match", () => {
    expect(
      describeScenePacingFit({ approvedShotCount: 3, targetShotCount: 3 }),
    ).toBe("on_pace");
  });

  // Having more images than asked for is a deliberate choice, not a fault.
  it("notes extra images without treating them as a problem", () => {
    expect(
      describeScenePacingFit({ approvedShotCount: 5, targetShotCount: 3 }),
    ).toBe("dense");
  });
});
