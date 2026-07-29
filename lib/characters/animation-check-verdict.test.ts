import { describe, expect, it } from "vitest";
import {
  buildAnimationChecks,
  canPreviewAnimation,
  isAnimationReady,
  MAXIMUM_TRANSPARENT_SHARE_BPS,
  MINIMUM_TRANSPARENT_SHARE_BPS,
} from "@/lib/characters/animation-check-verdict";
import {
  ANIMATION_POSE_KEYS,
  type AnimationPoseDiagnostic,
} from "@/lib/characters/animation-check-view";

function pose(
  overrides: Partial<AnimationPoseDiagnostic> & {
    pose: AnimationPoseDiagnostic["pose"];
  },
): AnimationPoseDiagnostic {
  return {
    present: true,
    contentType: "image/png",
    width: 1024,
    height: 1024,
    hasAlphaChannel: true,
    transparentShareBps: 6200,
    cornersTransparent: true,
    previewUrl: "https://storage.example/pose.png?signed",
    ...overrides,
  };
}

function healthyPoses(): AnimationPoseDiagnostic[] {
  return ANIMATION_POSE_KEYS.map((key) => pose({ pose: key }));
}

function checkById(
  poses: AnimationPoseDiagnostic[],
  id: string,
): { status: string; detail: string } {
  const row = buildAnimationChecks(poses).find((check) => check.id === id);
  if (!row) throw new Error(`missing check ${id}`);
  return row;
}

describe("buildAnimationChecks", () => {
  it("passes every check for a complete, genuinely cut out pose set", () => {
    const checks = buildAnimationChecks(healthyPoses());
    expect(checks.map((check) => check.status)).toEqual([
      "pass",
      "pass",
      "pass",
      "pass",
    ]);
    expect(isAnimationReady(checks)).toBe(true);
  });

  it("always returns the same four checks in the same order", () => {
    const ids = buildAnimationChecks(healthyPoses()).map((check) => check.id);
    expect(ids).toEqual(["pose-set", "alpha-channel", "cutout", "dimensions"]);
    expect(buildAnimationChecks([]).map((check) => check.id)).toEqual(ids);
  });

  it("fails the pose set and names the missing poses", () => {
    const poses = healthyPoses().map((item) =>
      item.pose === "blink"
        ? { ...item, present: false, previewUrl: null }
        : item,
    );
    const row = checkById(poses, "pose-set");
    expect(row.status).toBe("fail");
    expect(row.detail).toContain("Blinking");
  });

  it("fails when a pose was stored without an alpha channel", () => {
    const poses = healthyPoses().map((item) =>
      item.pose === "talkOpen"
        ? {
            ...item,
            contentType: "image/jpeg",
            hasAlphaChannel: false,
            transparentShareBps: 0,
            cornersTransparent: false,
          }
        : item,
    );
    const row = checkById(poses, "alpha-channel");
    expect(row.status).toBe("fail");
    expect(row.detail).toContain("Talking (mouth open)");
    expect(row.detail).toContain("cannot hold transparency");
  });

  it("blames the generation, not the format, for an opaque webp or png", () => {
    // The real-world case: poses generated before transparency was requested.
    // WebP holds alpha perfectly well, so calling this a format problem would
    // send the reader to the wrong setting.
    const poses = healthyPoses().map((item) => ({
      ...item,
      contentType: "image/webp",
      hasAlphaChannel: false,
      transparentShareBps: 0,
      cornersTransparent: false,
    }));
    const row = checkById(poses, "alpha-channel");
    expect(row.status).toBe("fail");
    expect(row.detail).toContain("opaque background");
    expect(row.detail).toContain("regenerating");
    expect(row.detail).not.toContain("cannot hold transparency");
  });

  it("fails an alpha image whose background was painted in anyway", () => {
    const poses = healthyPoses().map((item) =>
      item.pose === "idle"
        ? {
            ...item,
            transparentShareBps: MINIMUM_TRANSPARENT_SHARE_BPS - 1,
            cornersTransparent: false,
          }
        : item,
    );
    const row = checkById(poses, "cutout");
    expect(row.status).toBe("fail");
    expect(row.detail).toContain("Idle");
    expect(isAnimationReady(buildAnimationChecks(poses))).toBe(false);
  });

  it("fails a near-empty generation ahead of the painted-in rule", () => {
    const poses = healthyPoses().map((item) =>
      item.pose === "idle"
        ? { ...item, transparentShareBps: MAXIMUM_TRANSPARENT_SHARE_BPS + 1 }
        : item,
    );
    const row = checkById(poses, "cutout");
    expect(row.status).toBe("fail");
    expect(row.detail).toContain("Almost nothing is drawn");
  });

  it("warns rather than fails when only the frame edge is opaque", () => {
    const poses = healthyPoses().map((item) =>
      item.pose === "blink" ? { ...item, cornersTransparent: false } : item,
    );
    const checks = buildAnimationChecks(poses);
    const row = checks.find((check) => check.id === "cutout");
    expect(row?.status).toBe("warn");
    // A halo is a quality problem, not a blocker: the sprite still animates.
    expect(isAnimationReady(checks)).toBe(true);
  });

  it("fails when poses do not share dimensions", () => {
    const poses = healthyPoses().map((item) =>
      item.pose === "talkClosed" ? { ...item, height: 1536 } : item,
    );
    const row = checkById(poses, "dimensions");
    expect(row.status).toBe("fail");
    expect(row.detail).toContain("Talking (mouth closed)");
  });

  it("reports every check as failing when nothing has been generated", () => {
    const poses = ANIMATION_POSE_KEYS.map((key) =>
      pose({
        pose: key,
        present: false,
        previewUrl: null,
        contentType: null,
        width: null,
        height: null,
        hasAlphaChannel: false,
        transparentShareBps: 0,
        cornersTransparent: false,
      }),
    );
    const checks = buildAnimationChecks(poses);
    expect(checks.every((check) => check.status === "fail")).toBe(true);
    expect(isAnimationReady(checks)).toBe(false);
  });
});

describe("canPreviewAnimation", () => {
  it("allows the preview whenever all four stills are available", () => {
    expect(canPreviewAnimation(healthyPoses())).toBe(true);
  });

  it("still allows the preview for a failing but complete pose set", () => {
    const poses = healthyPoses().map((item) => ({
      ...item,
      hasAlphaChannel: false,
      transparentShareBps: 0,
    }));
    expect(isAnimationReady(buildAnimationChecks(poses))).toBe(false);
    expect(canPreviewAnimation(poses)).toBe(true);
  });

  it("blocks the preview when a pose has no signed URL", () => {
    const poses = healthyPoses().map((item) =>
      item.pose === "talkOpen" ? { ...item, previewUrl: null } : item,
    );
    expect(canPreviewAnimation(poses)).toBe(false);
  });
});
