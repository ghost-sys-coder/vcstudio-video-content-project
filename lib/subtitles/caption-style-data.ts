/**
 * Pure, dependency-free subtitle type definitions.
 *
 * This module intentionally imports nothing so it can be shared by the Drizzle
 * schema (for the `caption_style` JSONB column type), the Zod validation layer,
 * the pure subtitle domain logic, and client components without creating an
 * import cycle or pulling server-only code into the browser bundle.
 */

export type SubtitleGranularity = "scene" | "sentence";

/** Vertical placement. Kept as `position` so existing stored styles stay valid. */
export type SubtitlePosition = "bottom" | "middle" | "top";

/** Horizontal placement, the second axis. Centre matches the previous fixed value. */
export type SubtitleHorizontalPosition = "left" | "center" | "right";

/**
 * How a cue arrives and leaves.
 *
 * "none" is the historical behaviour, a hard cut, and stays the default so no
 * existing project changes appearance. "slide-fade" is what "fade in from the
 * bottom" means: a short travel combined with the fade.
 */
export type CaptionEntranceEffect = "none" | "fade" | "slide-fade";

/** The edge a sliding cue travels from, and back toward when leaving. */
export type CaptionEntranceDirection = "top" | "bottom" | "left" | "right";

export interface CaptionStyleData {
  /** Font family name understood by the renderer. */
  fontFamily: string;
  /** Caption font size as a percentage of the video height. */
  fontSizePercent: number;
  /** Primary text fill, `#rrggbb`. */
  primaryColor: string;
  /** Text outline color, `#rrggbb`. */
  outlineColor: string;
  /** Caption box background color, `#rrggbb`. */
  backgroundColor: string;
  /** Background opacity as a whole percentage (0 = no box). */
  backgroundOpacityPercent: number;
  /** Vertical placement of the caption block. */
  position: SubtitlePosition;
  /** Horizontal placement of the caption block. */
  horizontalPosition: SubtitleHorizontalPosition;
  /** How a cue arrives. "none" is a hard cut, as before this existed. */
  entranceEffect: CaptionEntranceEffect;
  /** Which edge a sliding cue travels from. Ignored unless the effect slides. */
  entranceDirection: CaptionEntranceDirection;
  /** How long the arrival takes. Shortened automatically for very brief cues. */
  entranceDurationMilliseconds: number;
  /** Whether a cue also leaves with the mirror of its entrance. */
  exitMatchesEntrance: boolean;
  bold: boolean;
  uppercase: boolean;
  /** Soft wrap target; segmentation never emits a line longer than this. */
  maxLineCharacters: number;
  /** Horizontal/vertical safe margin as a percentage of each edge. */
  safeMarginPercent: number;
}

/**
 * Manual per-segment text overrides. The key is `${sceneVersionId}:${index}` so
 * an override survives audio regeneration (timing recomputes) but is discarded
 * once the underlying scene version changes.
 */
export type SubtitleSegmentTextOverrides = Record<string, string>;
