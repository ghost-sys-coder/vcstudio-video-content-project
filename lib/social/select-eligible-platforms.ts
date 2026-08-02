import type { MediaAssetKind } from "@/db/schema";
import {
  getPlatformPostCapability,
  SOCIAL_POST_PLATFORMS,
  type SocialPostPlatform,
} from "@/lib/social/platform-post-capabilities";

export type PostAttachmentSummary = {
  imageCount: number;
  videoCount: number;
};

/**
 * Why a platform cannot take the current draft.
 *
 * `requirement` is a standing property of the platform that the draft has not
 * met yet — true of an untouched composer, and not something the author did
 * wrong. `violation` means the draft actively breaks a limit and something has
 * to be removed or shortened.
 *
 * The composer needs the difference because it renders both: showing "YouTube
 * needs one video" in the same alarmed red as "that is 400 characters too long"
 * tells an author their empty post is broken, which is how five of six
 * destinations end up looking like errors before a word is typed.
 */
export type IneligibilitySeverity = "requirement" | "violation";

export type PlatformEligibility =
  | { platform: SocialPostPlatform; eligible: true }
  | {
      platform: SocialPostPlatform;
      eligible: false;
      reason: string;
      severity: IneligibilitySeverity;
      /** Secondary explanation, shown under the reason rather than inside it. */
      detail?: string;
    };

export function summarizeAttachments(
  kinds: MediaAssetKind[],
): PostAttachmentSummary {
  return {
    imageCount: kinds.filter((kind) => kind === "image").length,
    videoCount: kinds.filter((kind) => kind === "video").length,
  };
}

/**
 * Decides, for one platform, whether the current draft could be sent there.
 *
 * Runs in the composer to enable or disable each destination with its reason
 * shown, and again server-side before dispatch — the same pure function both
 * times, so the UI cannot promise something the publish path then refuses.
 *
 * Text length is checked against the flattened plain text, not the document, so
 * the count matches exactly what the platform receives.
 */
export function checkPlatformEligibility(input: {
  platform: SocialPostPlatform;
  attachments: PostAttachmentSummary;
  plainTextLength: number;
}): PlatformEligibility {
  const { platform } = input;
  const capability = getPlatformPostCapability(platform);
  const { imageCount, videoCount } = input.attachments;
  const hasMedia = imageCount + videoCount > 0;

  const ineligible = (
    reason: string,
    severity: IneligibilitySeverity,
    detail?: string,
  ): PlatformEligibility => ({
    platform,
    eligible: false,
    reason,
    severity,
    ...(detail === undefined ? {} : { detail }),
  });

  /** What this platform structurally needs, plus the reason it needs it. */
  const unmetRequirement = (): PlatformEligibility =>
    ineligible(
      capability.mediaRequirement,
      "requirement",
      capability.mediaRationale,
    );

  if (input.plainTextLength === 0 && !hasMedia)
    return ineligible("Write something or attach media first.", "requirement");

  if (!hasMedia && !capability.allowsTextOnly) return unmetRequirement();

  if (videoCount > 0 && imageCount > 0 && capability.requiresSingleMediaKind)
    return ineligible(
      "Attach either images or one video, not both.",
      "violation",
      "No platform in this list mixes them in a single post.",
    );

  if (videoCount > 1)
    return ineligible("Only one video can be attached to a post.", "violation");

  // Attaching something the platform cannot take is the author's to undo, so it
  // reads as a violation rather than a standing requirement.
  if (videoCount === 1 && !capability.allowsVideo)
    return ineligible(capability.mediaRequirement, "violation");

  if (imageCount > 0) {
    if (!capability.images)
      return ineligible(capability.mediaRequirement, "violation");
    if (imageCount > capability.images.max)
      return ineligible(
        `Attach at most ${capability.images.max} image${capability.images.max === 1 ? "" : "s"} for this platform.`,
        "violation",
      );
    if (imageCount < capability.images.min)
      return ineligible(
        `Attach at least ${capability.images.min} image${capability.images.min === 1 ? "" : "s"} for this platform.`,
        "violation",
      );
  }

  if (input.plainTextLength > capability.maxCharacters)
    return ineligible(
      `That is ${input.plainTextLength.toLocaleString()} characters; the limit here is ${capability.maxCharacters.toLocaleString()}.`,
      "violation",
    );

  return { platform, eligible: true };
}

/** Every platform's eligibility, in a stable order, for the composer's picker. */
export function selectEligiblePlatforms(input: {
  attachments: PostAttachmentSummary;
  plainTextLength: number;
}): PlatformEligibility[] {
  return SOCIAL_POST_PLATFORMS.map((platform) =>
    checkPlatformEligibility({ ...input, platform }),
  );
}
