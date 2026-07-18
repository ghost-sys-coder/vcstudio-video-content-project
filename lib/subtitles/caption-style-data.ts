/**
 * Pure, dependency-free subtitle type definitions.
 *
 * This module intentionally imports nothing so it can be shared by the Drizzle
 * schema (for the `caption_style` JSONB column type), the Zod validation layer,
 * the pure subtitle domain logic, and client components without creating an
 * import cycle or pulling server-only code into the browser bundle.
 */

export type SubtitleGranularity = "scene" | "sentence";

export type SubtitlePosition = "bottom" | "middle" | "top";

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
