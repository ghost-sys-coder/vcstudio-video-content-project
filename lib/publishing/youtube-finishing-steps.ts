/**
 * The steps that finish a YouTube release after the video bytes are up.
 *
 * Uploading the video and finishing the package are different operations with
 * different failure modes, and collapsing them loses the distinction that
 * matters most: a thumbnail that failed to attach must be retryable on its own,
 * without sending the video again. Each step is therefore tracked separately,
 * and the publication is not described as complete while any of them is
 * outstanding.
 *
 * Scopes verified against the YouTube Data API reference on 2026-09-11.
 */

export const YOUTUBE_FINISHING_STEPS = [
  "thumbnail",
  "captions",
  "playlist",
] as const;

export type YouTubeFinishingStep = (typeof YOUTUBE_FINISHING_STEPS)[number];

/**
 * `pending`  — not attempted yet.
 * `succeeded` — done.
 * `failed`   — attempted and failed; can be retried without re-uploading.
 * `unsupported` — this account or grant cannot do it at all; retrying is
 *                 pointless and a person has to finish it on YouTube.
 * `skipped`  — there was nothing to do, e.g. no thumbnail was chosen.
 */
export const FINISHING_STEP_STATES = [
  "pending",
  "succeeded",
  "failed",
  "unsupported",
  "skipped",
] as const;

export type FinishingStepState = (typeof FINISHING_STEP_STATES)[number];

export const FINISHING_STEP_LABELS: Record<YouTubeFinishingStep, string> = {
  thumbnail: "Custom thumbnail",
  captions: "Caption track",
  playlist: "Playlist",
};

export const FINISHING_STATE_LABELS: Record<FinishingStepState, string> = {
  pending: "Not done yet",
  succeeded: "Done",
  failed: "Failed",
  unsupported: "Needs finishing on YouTube",
  skipped: "Nothing to do",
};

/** The scope each step needs, beyond the upload scope already held. */
export const YOUTUBE_UPLOAD_SCOPE =
  "https://www.googleapis.com/auth/youtube.upload";
export const YOUTUBE_FORCE_SSL_SCOPE =
  "https://www.googleapis.com/auth/youtube.force-ssl";
export const YOUTUBE_MANAGE_SCOPE = "https://www.googleapis.com/auth/youtube";

/**
 * Which granted scopes allow each step.
 *
 * `thumbnails.set` accepts the upload scope, so attaching a thumbnail needs no
 * new consent. `captions.insert` accepts only `youtube.force-ssl` (or the
 * partner scope, which is not appropriate here), and `playlistItems.insert`
 * accepts `youtube` or `youtube.force-ssl`. Neither is covered by an
 * upload-only grant, which is why those two steps can legitimately be
 * unsupported on a connection that works perfectly well for uploading.
 */
const STEP_SCOPES: Record<YouTubeFinishingStep, readonly string[]> = {
  thumbnail: [
    YOUTUBE_UPLOAD_SCOPE,
    YOUTUBE_MANAGE_SCOPE,
    YOUTUBE_FORCE_SSL_SCOPE,
  ],
  captions: [YOUTUBE_FORCE_SSL_SCOPE],
  playlist: [YOUTUBE_MANAGE_SCOPE, YOUTUBE_FORCE_SSL_SCOPE],
};

export function isStepScopeGranted(input: {
  step: YouTubeFinishingStep;
  grantedScopes: readonly string[];
}): boolean {
  return STEP_SCOPES[input.step].some((scope) =>
    input.grantedScopes.includes(scope),
  );
}

/**
 * What a person has to do themselves, when this app cannot do it for them.
 *
 * Every message names the concrete action on YouTube. "Unsupported" with no
 * instruction would leave a creator believing the release was finished when a
 * piece of it was not.
 */
export function describeExternalFinishingAction(
  step: YouTubeFinishingStep,
): string {
  if (step === "thumbnail")
    return "Set the thumbnail from YouTube Studio: open the video, choose Edit, then upload the image.";
  if (step === "captions")
    return "Add the caption file from YouTube Studio: open the video, choose Subtitles, then upload the .srt file. Export it from the Assembly tab.";
  return "Add the video to a playlist from YouTube Studio: open the video, choose Save, then pick the playlist.";
}

/** Why a step could not run, when the reason is a missing permission. */
export function describeMissingScope(step: YouTubeFinishingStep): string {
  if (step === "captions")
    return "This channel is connected for uploading only, which does not permit caption uploads.";
  if (step === "playlist")
    return "This channel is connected for uploading only, which does not permit playlist changes.";
  return "This channel's connection does not permit setting a thumbnail.";
}

export interface FinishingStepView {
  step: YouTubeFinishingStep;
  label: string;
  state: FinishingStepState;
  stateLabel: string;
  /** The safe reason, when something went wrong or could not be attempted. */
  detail: string | null;
  /** What to do by hand, when this app cannot finish it. */
  externalAction: string | null;
  /** Whether trying again could plausibly work. */
  retriable: boolean;
}

export function toFinishingStepView(input: {
  step: YouTubeFinishingStep;
  state: FinishingStepState;
  detail: string | null;
}): FinishingStepView {
  return {
    step: input.step,
    label: FINISHING_STEP_LABELS[input.step],
    state: input.state,
    stateLabel: FINISHING_STATE_LABELS[input.state],
    detail: input.detail,
    externalAction:
      input.state === "unsupported" || input.state === "failed"
        ? describeExternalFinishingAction(input.step)
        : null,
    // An unsupported step cannot be fixed by retrying: the grant or the account
    // is what is missing, so offering a retry would waste a person's time.
    retriable: input.state === "failed",
  };
}

/**
 * Whether a release is genuinely finished.
 *
 * A step that failed or is unsupported keeps this false. The acceptance this
 * enforces is blunt on purpose: "complete" must never hide work that a person
 * still has to do.
 */
export function isReleaseFullyFinished(
  steps: readonly { state: FinishingStepState }[],
): boolean {
  return steps.every(
    (entry) => entry.state === "succeeded" || entry.state === "skipped",
  );
}

/** A short summary of what is still outstanding, for a status line. */
export function describeOutstandingFinishing(
  steps: readonly FinishingStepView[],
): string | null {
  const outstanding = steps.filter(
    (entry) => entry.state !== "succeeded" && entry.state !== "skipped",
  );
  if (outstanding.length === 0) return null;
  const names = outstanding.map((entry) => entry.label.toLowerCase());
  if (names.length === 1) return `The ${names[0]} still needs finishing.`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} still need finishing.`;
}
