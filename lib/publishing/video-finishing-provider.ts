import type { FinishingStepState } from "@/lib/publishing/youtube-finishing-steps";

/**
 * How one finishing step ended.
 *
 * `detail` is always a message a creator can act on, never a raw provider
 * error: Google's error bodies carry quota project ids and internal hints that
 * must not reach a user.
 */
export interface FinishingStepOutcome {
  state: Exclude<FinishingStepState, "pending">;
  detail: string | null;
}

/** YouTube's 2MB limit for a custom thumbnail, from the thumbnails.set reference. */
export const YOUTUBE_THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;

/** The image types thumbnails.set accepts. */
export const YOUTUBE_THUMBNAIL_CONTENT_TYPES = ["image/jpeg", "image/png"];

/**
 * The steps that finish a release after its video is uploaded.
 *
 * A separate interface from `VideoPublishProvider` on purpose: only YouTube has
 * these operations today, and forcing every provider to implement three no-ops
 * would say something untrue about what the others can do.
 */
export interface VideoFinishingProvider {
  setThumbnail(input: {
    accessToken: string;
    videoId: string;
    /** Short-lived signed URL the provider streams the image from. */
    imageUrl: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<FinishingStepOutcome>;

  insertCaptions(input: {
    accessToken: string;
    videoId: string;
    /** BCP-47 language of the caption track, e.g. "en". */
    language: string;
    name: string;
    body: string;
  }): Promise<FinishingStepOutcome>;

  addToPlaylist(input: {
    accessToken: string;
    videoId: string;
    playlistId: string;
  }): Promise<FinishingStepOutcome>;
}

export function supportsFinishing(
  provider: unknown,
): provider is VideoFinishingProvider {
  return (
    typeof provider === "object" &&
    provider !== null &&
    typeof (provider as VideoFinishingProvider).setThumbnail === "function"
  );
}
