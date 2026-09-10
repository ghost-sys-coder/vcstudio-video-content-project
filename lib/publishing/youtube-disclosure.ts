/**
 * The declarations YouTube asks a creator to make about their own video.
 *
 * These are the creator's statements, never the application's. The upload path
 * previously sent `selfDeclaredMadeForKids: false` as a constant, which meant
 * this app was making a legal audience declaration on behalf of a person who
 * had never been asked. That is the defect this module exists to remove, and
 * the reason nothing here has a default: an undeclared field stays undeclared
 * and blocks the upload rather than being guessed.
 *
 * Verified against the YouTube Data API reference for `videos.insert` on
 * 2026-09-11. `status.selfDeclaredMadeForKids` and `status.containsSyntheticMedia`
 * are both optional to the API. They are required *here* because sending a
 * value nobody chose is the thing being fixed, and because YouTube asks
 * creators to make both disclosures when publishing through its own interface.
 */

/** Whether the video is directed to children, in COPPA's sense. */
export type YouTubeAudience = "made_for_kids" | "not_made_for_kids";

export const YOUTUBE_AUDIENCE_LABELS: Record<YouTubeAudience, string> = {
  made_for_kids: "Yes, it is made for kids",
  not_made_for_kids: "No, it is not made for kids",
};

/**
 * What the creator has said about this release.
 *
 * Null means "not answered yet", which is distinct from "answered no". The
 * distinction is the whole point: a false that nobody chose is exactly what
 * this replaces.
 */
export interface YouTubeDisclosures {
  madeForKids: boolean | null;
  containsSyntheticMedia: boolean | null;
}

export interface DisclosureRequirement {
  /** The field that is still unanswered. */
  field: "madeForKids" | "containsSyntheticMedia";
  message: string;
}

/**
 * Why this app asks about synthetic media at all.
 *
 * Every project here generates its visuals with an image model and its
 * narration with a speech model, so the question is never hypothetical. It is
 * still the creator's call: whether the result is *realistic* altered or
 * synthetic content, in YouTube's sense, depends on what was made, and this app
 * is in no position to judge that for them.
 */
export const SYNTHETIC_MEDIA_GUIDANCE =
  "This project's visuals and narration are generated. YouTube asks you to disclose content that looks realistic but is synthetic or meaningfully altered. Purely animated, obviously unreal, or clearly stylised content usually does not need the label. You decide, and YouTube shows the label to viewers.";

export const MADE_FOR_KIDS_GUIDANCE =
  "YouTube requires every upload to declare whether it is made for kids. The setting changes what features are available on the video, including comments and personalised ads.";

/**
 * What still has to be answered before this can be uploaded.
 *
 * Returns every outstanding declaration rather than the first, so a creator
 * fixes both in one pass instead of being told about them one at a time.
 */
export function findMissingDisclosures(
  disclosures: YouTubeDisclosures,
): DisclosureRequirement[] {
  const missing: DisclosureRequirement[] = [];
  if (disclosures.madeForKids === null)
    missing.push({
      field: "madeForKids",
      message: "Declare whether this video is made for kids.",
    });
  if (disclosures.containsSyntheticMedia === null)
    missing.push({
      field: "containsSyntheticMedia",
      message:
        "Declare whether this video contains realistic synthetic or altered content.",
    });
  return missing;
}

export function areDisclosuresComplete(
  disclosures: YouTubeDisclosures,
): boolean {
  return findMissingDisclosures(disclosures).length === 0;
}

/**
 * The `status` fields to send, once every declaration has actually been made.
 *
 * Returns null when anything is still unanswered, so there is no path through
 * this module that produces a request body containing a declaration the
 * creator did not make.
 */
export function buildYouTubeStatusDisclosures(
  disclosures: YouTubeDisclosures,
): {
  selfDeclaredMadeForKids: boolean;
  containsSyntheticMedia: boolean;
} | null {
  if (
    disclosures.madeForKids === null ||
    disclosures.containsSyntheticMedia === null
  )
    return null;
  return {
    selfDeclaredMadeForKids: disclosures.madeForKids,
    containsSyntheticMedia: disclosures.containsSyntheticMedia,
  };
}

/** How a completed declaration reads back to the creator. */
export function describeDisclosures(disclosures: YouTubeDisclosures): string {
  const audience =
    disclosures.madeForKids === null
      ? "Audience not declared"
      : disclosures.madeForKids
        ? "Made for kids"
        : "Not made for kids";
  const synthetic =
    disclosures.containsSyntheticMedia === null
      ? "AI disclosure not declared"
      : disclosures.containsSyntheticMedia
        ? "Disclosed as altered or synthetic"
        : "Not disclosed as altered or synthetic";
  return `${audience} · ${synthetic}`;
}
