/**
 * What assembly should say about the captions.
 *
 * Captions used to live in a tab of their own, which meant a creator could
 * reach the render controls without ever having read a cue. Assembly now states
 * where the captions stand, and the wording is kept here rather than in the
 * component so it can be asserted.
 *
 * Nothing here decides whether captions are burned into a render. That remains
 * an explicit per-render choice, so this never implies a caption track will
 * appear in the output.
 */
export type CaptionReviewTone = "missing" | "unreviewed" | "ready";

export interface CaptionReviewSummary {
  tone: CaptionReviewTone;
  headline: string;
  detail: string;
  /** The label of the link into the captions view. */
  actionLabel: string;
}

export function describeCaptionReview(input: {
  captionCount: number;
  timelineStatus: "ready" | "invalid";
  captionsEnabled: boolean;
}): CaptionReviewSummary {
  if (!input.captionsEnabled)
    return {
      tone: "missing",
      headline: "Captions are turned off",
      detail:
        "Subtitle generation is disabled by server configuration, so no cues exist to review.",
      actionLabel: "Open captions",
    };

  if (input.captionCount === 0)
    return {
      tone: "missing",
      headline: "No captions yet",
      detail:
        "Captions are derived from approved narration audio. Build the timeline once the audio is approved.",
      actionLabel: "Open captions",
    };

  if (input.timelineStatus === "invalid")
    return {
      tone: "unreviewed",
      headline: `${input.captionCount} cues, timeline not ready`,
      detail:
        "The cues exist but the timeline still has blocking issues, so what renders may not match what you see.",
      actionLabel: "Review captions",
    };

  return {
    tone: "ready",
    headline: `${input.captionCount} cues ready`,
    detail:
      "Read the wording and timing before rendering. Whether captions are burned in stays a per-render choice.",
    actionLabel: "Review captions",
  };
}
