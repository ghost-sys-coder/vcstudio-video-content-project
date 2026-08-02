import type { PlatformEligibility } from "@/lib/social/select-eligible-platforms";

/**
 * How one eligibility result should read.
 *
 * Three tones, not two. The composer previously had only "fine" and "red",
 * which meant an untouched draft lit up five of six destinations in the same
 * colour used for genuine failures — telling the author something was wrong
 * before they had done anything at all.
 *
 * - `ready` — this destination will take the post.
 * - `info` — a standing requirement of the platform, not yet met. Neutral: it
 *   is a fact about the platform, not a fault in the draft.
 * - `warning` — the draft breaks a limit and something must be changed. Amber,
 *   deliberately **not** destructive red, which stays reserved for operations
 *   that actually failed.
 */
export type EligibilityTone = "ready" | "info" | "warning";

export type EligibilityPresentation = {
  tone: EligibilityTone;
  /** Text colour classes, for inline use such as the character counter. */
  className: string;
  /** Tinted block classes, for the notice rendered as its own callout. */
  containerClassName: string;
  message: string;
  detail?: string;
};

/**
 * Colours come from the `--notice-*` design tokens rather than palette
 * utilities, because a `dark:` variant does not reach the `dim` theme and would
 * leave every notice at its light-mode colour on a dark surface.
 */
const TONE_CLASSNAMES = {
  ready: "text-notice-ready-foreground",
  info: "text-muted-foreground",
  warning: "text-notice-warning-foreground",
} as const satisfies Record<EligibilityTone, string>;

/**
 * Each tone as a filled callout, so a notice is a block on the page rather than
 * a line of coloured text that scans as part of the preview above it.
 *
 * The fills are **opaque tokens, not alpha tints**: a translucent wash over a
 * white card was not visible enough to serve as a notice at all. They are also
 * deliberately unequal — `warning` is the only tone asking the author to change
 * something, so it is the most saturated; `info` is a calm blue that still
 * reads as its own block, so three media-requiring platforms do not turn a
 * blank composer into a wall of alarm.
 */
const TONE_CONTAINER_CLASSNAMES = {
  ready:
    "rounded-lg border border-notice-ready-edge bg-notice-ready px-2.5 py-2 text-notice-ready-foreground",
  info: "rounded-lg border border-notice-info-edge bg-notice-info px-2.5 py-2 text-notice-info-foreground",
  warning:
    "rounded-lg border border-notice-warning-edge bg-notice-warning px-2.5 py-2 text-notice-warning-foreground",
} as const satisfies Record<EligibilityTone, string>;

export function toneClassName(tone: EligibilityTone): string {
  return TONE_CLASSNAMES[tone];
}

export function toneContainerClassName(tone: EligibilityTone): string {
  return TONE_CONTAINER_CLASSNAMES[tone];
}

export function presentEligibility(
  eligibility: PlatformEligibility,
  platformLabel: string,
): EligibilityPresentation {
  if (eligibility.eligible)
    return {
      tone: "ready",
      className: TONE_CLASSNAMES.ready,
      containerClassName: TONE_CONTAINER_CLASSNAMES.ready,
      message: `Ready for ${platformLabel}.`,
    };

  const tone: EligibilityTone =
    eligibility.severity === "requirement" ? "info" : "warning";

  return {
    tone,
    className: TONE_CLASSNAMES[tone],
    containerClassName: TONE_CONTAINER_CLASSNAMES[tone],
    message: eligibility.reason,
    ...(eligibility.detail === undefined ? {} : { detail: eligibility.detail }),
  };
}
