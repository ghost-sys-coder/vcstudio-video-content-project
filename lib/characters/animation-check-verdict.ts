/**
 * Turns measured pose diagnostics into the pass/warn/fail rows shown by the
 * character animation check.
 *
 * Pure and I/O-free so the rules that decide "this character will not animate"
 * are unit-testable without R2, a database, or an image decoder.
 */

import {
  ANIMATION_POSE_KEYS,
  ANIMATION_POSE_LABELS,
  type AnimationCheckRow,
  type AnimationPoseDiagnostic,
} from "@/lib/characters/animation-check-view";

/**
 * Below this share of fully transparent pixels the image is treated as having a
 * painted-in background rather than a cutout. A character standing in a square
 * frame leaves far more than 5% of it empty, so anything under this means the
 * model filled the background in despite being asked not to — the exact failure
 * that makes a sprite render as an opaque rectangle over the plate.
 */
export const MINIMUM_TRANSPARENT_SHARE_BPS = 500;

/**
 * Above this share there is essentially nothing drawn — a blank or near-blank
 * generation that would composite as an invisible character.
 */
export const MAXIMUM_TRANSPARENT_SHARE_BPS = 9800;

/**
 * Content types that can carry an alpha channel at all.
 *
 * The distinction matters for the advice given: a JPEG pose is a format
 * mistake, while an opaque WebP or PNG pose is a *generation* that came back
 * without transparency — most often because it predates transparent poses being
 * requested. Both need regenerating, but conflating them sends the reader
 * looking at the wrong setting.
 */
const ALPHA_CAPABLE_CONTENT_TYPES = new Set(["image/png", "image/webp"]);

function formatSupportsAlpha(contentType: string | null): boolean {
  return contentType !== null && ALPHA_CAPABLE_CONTENT_TYPES.has(contentType);
}

function formatShare(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

function listPoses(poses: AnimationPoseDiagnostic[]): string {
  return poses.map((pose) => ANIMATION_POSE_LABELS[pose.pose]).join(", ");
}

/**
 * Builds the check rows for one character, in a fixed order so the list does
 * not reshuffle between runs.
 */
export function buildAnimationChecks(
  poses: AnimationPoseDiagnostic[],
): AnimationCheckRow[] {
  const present = poses.filter((pose) => pose.present);
  const missing = poses.filter((pose) => !pose.present);
  const nothingToInspect = present.length === 0;
  const noPosesDetail =
    "No pose stills have been generated for this character.";

  const poseSet: AnimationCheckRow = missing.length
    ? {
        id: "pose-set",
        label: "All four pose stills exist",
        status: "fail",
        detail: `Missing: ${listPoses(missing)}. A character is skipped entirely at render time unless all four poses are present.`,
      }
    : {
        id: "pose-set",
        label: "All four pose stills exist",
        status: "pass",
        detail: "Idle, both talking poses, and the blink are all generated.",
      };

  const withoutAlpha = present.filter((pose) => !pose.hasAlphaChannel);
  const wrongFormat = withoutAlpha.filter(
    (pose) => !formatSupportsAlpha(pose.contentType),
  );
  const generatedOpaque = withoutAlpha.filter((pose) =>
    formatSupportsAlpha(pose.contentType),
  );
  const alphaChannel: AnimationCheckRow = nothingToInspect
    ? {
        id: "alpha-channel",
        label: "Poses have a transparent background",
        status: "fail",
        detail: noPosesDetail,
      }
    : withoutAlpha.length
      ? {
          id: "alpha-channel",
          label: "Poses have a transparent background",
          status: "fail",
          detail: [
            wrongFormat.length
              ? `Stored in a format that cannot hold transparency: ${listPoses(wrongFormat)}.`
              : null,
            generatedOpaque.length
              ? `Generated with an opaque background: ${listPoses(generatedOpaque)}. The format could hold transparency, so these were produced before transparent poses were requested — regenerating them is the fix.`
              : null,
            "Until then they composite as solid rectangles over the scene plate.",
          ]
            .filter((part) => part !== null)
            .join(" "),
        }
      : {
          id: "alpha-channel",
          label: "Poses have a transparent background",
          status: "pass",
          detail: "Every pose carries a real alpha channel.",
        };

  const paintedIn = present.filter(
    (pose) =>
      pose.hasAlphaChannel &&
      pose.transparentShareBps < MINIMUM_TRANSPARENT_SHARE_BPS,
  );
  const nearlyEmpty = present.filter(
    (pose) => pose.transparentShareBps > MAXIMUM_TRANSPARENT_SHARE_BPS,
  );
  const opaqueCorners = present.filter(
    (pose) => pose.hasAlphaChannel && !pose.cornersTransparent,
  );
  const cutout: AnimationCheckRow = nothingToInspect
    ? {
        id: "cutout",
        label: "Poses are actually cut out",
        status: "fail",
        detail: noPosesDetail,
      }
    : nearlyEmpty.length
      ? {
          id: "cutout",
          label: "Poses are actually cut out",
          status: "fail",
          detail: `Almost nothing is drawn in: ${listPoses(nearlyEmpty)} (over ${formatShare(MAXIMUM_TRANSPARENT_SHARE_BPS)} transparent). The character would be invisible on stage.`,
        }
      : paintedIn.length
        ? {
            id: "cutout",
            label: "Poses are actually cut out",
            status: "fail",
            detail: `Background is painted in on: ${listPoses(paintedIn)} (under ${formatShare(MINIMUM_TRANSPARENT_SHARE_BPS)} transparent). The alpha channel is there but nothing is transparent, so the pose will cover the scene plate. Regenerate these poses.`,
          }
        : opaqueCorners.length
          ? {
              id: "cutout",
              label: "Poses are actually cut out",
              status: "warn",
              detail: `Opaque pixels reach the frame edge on: ${listPoses(opaqueCorners)}. Usually a halo or a partial backdrop; the sprite will still animate, but check the preview for a visible box.`,
            }
          : {
              id: "cutout",
              label: "Poses are actually cut out",
              status: "pass",
              detail:
                "Every pose has genuinely transparent pixels reaching the frame edge.",
            };

  const firstPresent = present[0];
  const mismatched = firstPresent
    ? present.filter(
        (pose) =>
          pose.width !== firstPresent.width ||
          pose.height !== firstPresent.height,
      )
    : [];
  const dimensions: AnimationCheckRow = nothingToInspect
    ? {
        id: "dimensions",
        label: "Poses share the same dimensions",
        status: "fail",
        detail: noPosesDetail,
      }
    : mismatched.length
      ? {
          id: "dimensions",
          label: "Poses share the same dimensions",
          status: "fail",
          detail: `Different sizes in: ${listPoses(mismatched)}. The poses are stacked and cross-faded in place, so a size difference makes the character jump every time the mouth moves.`,
        }
      : {
          id: "dimensions",
          label: "Poses share the same dimensions",
          status: "pass",
          detail: `All poses are ${firstPresent?.width ?? 0}×${firstPresent?.height ?? 0}, so they stack without shifting.`,
        };

  return [poseSet, alphaChannel, cutout, dimensions];
}

/** True when nothing failed — the character is safe to animate with. */
export function isAnimationReady(checks: AnimationCheckRow[]): boolean {
  return !checks.some((check) => check.status === "fail");
}

/** True when all four stills exist, so the sprite can be driven in the player. */
export function canPreviewAnimation(poses: AnimationPoseDiagnostic[]): boolean {
  return ANIMATION_POSE_KEYS.every((key) =>
    poses.some((pose) => pose.pose === key && pose.present && pose.previewUrl),
  );
}
