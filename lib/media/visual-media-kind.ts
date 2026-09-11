import type { MediaAssetKind } from "@/db/schema";

/**
 * The kinds that can be *shown* on screen.
 *
 * The media library gained `audio` so a project can carry a background sound
 * bed. Several older surfaces — brand assets, social post previews — only ever
 * deal in something visible, and a sound file reaching them would be rendered
 * as a broken image rather than reported.
 *
 * This narrows explicitly and returns null instead of guessing, so each caller
 * has to say what it does about a sound file rather than defaulting to
 * "image" and displaying a blank box.
 */
export type VisualMediaKind = "image" | "video";

export function toVisualMediaKind(
  kind: MediaAssetKind,
): VisualMediaKind | null {
  return kind === "image" || kind === "video" ? kind : null;
}

export function isVisualMediaKind(kind: MediaAssetKind): boolean {
  return toVisualMediaKind(kind) !== null;
}
