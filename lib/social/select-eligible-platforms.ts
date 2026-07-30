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

export type PlatformEligibility =
  | { platform: SocialPostPlatform; eligible: true }
  | { platform: SocialPostPlatform; eligible: false; reason: string };

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

  const ineligible = (reason: string): PlatformEligibility => ({
    platform,
    eligible: false,
    reason,
  });

  if (input.plainTextLength === 0 && !hasMedia)
    return ineligible("Write something or attach media first.");

  if (!hasMedia && !capability.allowsTextOnly)
    return ineligible(capability.mediaRequirement);

  if (videoCount > 0 && imageCount > 0 && capability.requiresSingleMediaKind)
    return ineligible(
      "Attach either images or one video, not both — no platform in this list mixes them in a single post.",
    );

  if (videoCount > 1)
    return ineligible("Only one video can be attached to a post.");

  if (videoCount === 1 && !capability.allowsVideo)
    return ineligible(`${capability.mediaRequirement}`);

  if (imageCount > 0) {
    if (!capability.images) return ineligible(capability.mediaRequirement);
    if (imageCount > capability.images.max)
      return ineligible(
        `Attach at most ${capability.images.max} image${capability.images.max === 1 ? "" : "s"} for this platform.`,
      );
    if (imageCount < capability.images.min)
      return ineligible(
        `Attach at least ${capability.images.min} image${capability.images.min === 1 ? "" : "s"} for this platform.`,
      );
  }

  if (input.plainTextLength > capability.maxCharacters)
    return ineligible(
      `That is ${input.plainTextLength.toLocaleString()} characters; the limit here is ${capability.maxCharacters.toLocaleString()}.`,
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
