import type { ContentPlatform } from "@/db/schema";

/**
 * What each destination will actually accept as a post.
 *
 * The six platforms are **not interchangeable**, and pretending otherwise in
 * the UI would mean discovering it at publish time, after a schedule fired:
 *
 * - **LinkedIn**, **X**, and **Facebook** take text on its own, with or without
 *   media. X is the only one with a *short* text ceiling, so it is routinely the
 *   platform that drops out of a selection the others accept.
 * - **Instagram** requires media. There is no text-only Instagram post.
 * - **TikTok** requires a video. There is no image or text-only TikTok post
 *   through the Content Posting API this app is approved for.
 * - **YouTube** requires a video, because YouTube has **no public API for
 *   Community Posts** at all — a YouTube target is a video upload with the post
 *   body used as the description.
 *
 * So the composer derives which platforms are selectable from what is attached,
 * and shows the reason next to the ones that are not. Limits are the platforms'
 * published caption/description ceilings; they are enforced before dispatch so a
 * rejection costs a validation message rather than a failed scheduled run.
 */
export type PlatformPostCapability = {
  /** Whether a post with no media at all can go here. */
  allowsTextOnly: boolean;
  /** Null when images are not accepted at all. */
  images: { min: number; max: number } | null;
  allowsVideo: boolean;
  /** True when images and a video cannot be mixed in one post. */
  requiresSingleMediaKind: boolean;
  /** Ceiling on the flattened body text. */
  maxCharacters: number;
  /** Shown when this platform is unavailable for the current attachments. */
  mediaRequirement: string;
};

export const SOCIAL_POST_PLATFORMS = [
  "linkedin",
  "twitter",
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
] as const satisfies readonly ContentPlatform[];

export type SocialPostPlatform = (typeof SOCIAL_POST_PLATFORMS)[number];

export const PLATFORM_POST_CAPABILITIES = {
  linkedin: {
    allowsTextOnly: true,
    images: { min: 1, max: 20 },
    allowsVideo: true,
    requiresSingleMediaKind: true,
    maxCharacters: 3000,
    mediaRequirement: "Text on its own, up to 20 images, or one video.",
  },
  twitter: {
    allowsTextOnly: true,
    images: { min: 1, max: 4 },
    allowsVideo: true,
    requiresSingleMediaKind: true,
    // Set for a **Premium** account, on the owner's instruction (2026-08-02).
    //
    // X's ceiling belongs to the connected account, not to this app, and the
    // posting API exposes no way to read an account's tier — so this number is a
    // statement about who is connected, and it is only correct while that stays
    // true. 2,000 is deliberately short of Premium's full 25,000, leaving room
    // before the real limit rather than sitting on it.
    //
    // The consequence to know: a **non-Premium** account connected to this
    // workspace is capped at 280 by X, and anything longer is rejected at
    // publish time rather than caught here. If one is ever connected, this drops
    // back to 280 — which is why it is one number in one place.
    maxCharacters: 2000,
    mediaRequirement: "Text on its own, up to 4 images, or one video.",
  },
  facebook: {
    allowsTextOnly: true,
    images: { min: 1, max: 10 },
    allowsVideo: true,
    requiresSingleMediaKind: true,
    maxCharacters: 63_206,
    mediaRequirement: "Text on its own, images, or one video.",
  },
  instagram: {
    allowsTextOnly: false,
    images: { min: 1, max: 10 },
    allowsVideo: true,
    requiresSingleMediaKind: true,
    maxCharacters: 2200,
    mediaRequirement:
      "Instagram needs media: attach 1–10 images, or one video for a Reel.",
  },
  tiktok: {
    allowsTextOnly: false,
    images: null,
    allowsVideo: true,
    requiresSingleMediaKind: true,
    maxCharacters: 2200,
    mediaRequirement: "TikTok needs one video. It does not take image posts.",
  },
  youtube: {
    allowsTextOnly: false,
    images: null,
    allowsVideo: true,
    requiresSingleMediaKind: true,
    maxCharacters: 5000,
    mediaRequirement:
      "YouTube needs one video. Community posts have no public API, so a YouTube target is a video upload.",
  },
} as const satisfies Record<SocialPostPlatform, PlatformPostCapability>;

export function isSocialPostPlatform(
  platform: ContentPlatform,
): platform is SocialPostPlatform {
  return (SOCIAL_POST_PLATFORMS as readonly ContentPlatform[]).includes(
    platform,
  );
}

export function getPlatformPostCapability(
  platform: SocialPostPlatform,
): PlatformPostCapability {
  return PLATFORM_POST_CAPABILITIES[platform];
}
