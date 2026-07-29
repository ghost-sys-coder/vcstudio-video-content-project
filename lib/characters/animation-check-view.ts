/**
 * Shared shapes for the character animation check — the pre-flight test that
 * answers "will this character actually animate?" before a project is set up
 * as an animated video and money is spent on scene plates.
 *
 * Deliberately free of `server-only` and of any database or storage import so
 * the client section, the pure verdict logic, and the server loader can all
 * share one vocabulary.
 */

import type { CharacterReferenceType } from "@/db/schema";

export type AnimationPoseKey = "idle" | "talkOpen" | "talkClosed" | "blink";

/** The four poses in the order the sprite cycles them, for stable display. */
export const ANIMATION_POSE_KEYS = [
  "idle",
  "talkOpen",
  "talkClosed",
  "blink",
] as const satisfies readonly AnimationPoseKey[];

export const ANIMATION_POSE_REFERENCE_TYPES = {
  idle: "poseIdle",
  talkOpen: "poseTalkOpen",
  talkClosed: "poseTalkClosed",
  blink: "poseBlink",
} as const satisfies Record<AnimationPoseKey, CharacterReferenceType>;

export const ANIMATION_POSE_LABELS = {
  idle: "Idle",
  talkOpen: "Talking (mouth open)",
  talkClosed: "Talking (mouth closed)",
  blink: "Blinking",
} as const satisfies Record<AnimationPoseKey, string>;

/**
 * What was measured about one pose still. `transparentShareBps` and
 * `cornersTransparent` come from decoding the stored image's alpha channel, not
 * from what was requested at generation time — the whole point of the check is
 * that a request for a transparent background can come back opaque.
 */
export type AnimationPoseDiagnostic = {
  pose: AnimationPoseKey;
  present: boolean;
  contentType: string | null;
  width: number | null;
  height: number | null;
  /** The decoded image carries an alpha channel at all. */
  hasAlphaChannel: boolean;
  /** Share of fully transparent pixels, in basis points (0-10000). */
  transparentShareBps: number;
  /** Every corner of the frame is transparent, as a real cutout's would be. */
  cornersTransparent: boolean;
  /** Signed URL for the preview player. Null when the pose is missing. */
  previewUrl: string | null;
};

export type AnimationCheckStatus = "pass" | "warn" | "fail";

export type AnimationCheckRow = {
  id: string;
  label: string;
  status: AnimationCheckStatus;
  detail: string;
};

export type CharacterAnimationCheckView = {
  characterId: string;
  characterName: string;
  poses: AnimationPoseDiagnostic[];
  checks: AnimationCheckRow[];
  /** No failing check — this character is safe to build an animated video on. */
  ready: boolean;
  /**
   * All four stills exist, so the sprite can be driven in the player even if a
   * check failed. Seeing a broken sprite is more useful than seeing nothing.
   */
  canPreview: boolean;
};
