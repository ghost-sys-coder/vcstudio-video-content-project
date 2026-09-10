import type { VideoContentPlatform } from "@/lib/platforms/video-content-platforms";
import {
  createPublishingMetadataDraftMap,
  type GeneratedPublishingMetadata,
  type PublishingMetadataDraftMap,
} from "@/lib/publishing/generated-metadata";

/** The saved fields this needs from a release package. */
export interface SavedReleaseMetadata {
  platform: VideoContentPlatform;
  channelProfileId: string | null;
  title: string;
  description: string;
  tags: string[];
}

/** Whether a saved package carries anything a creator actually wrote. */
export function hasSavedReleaseMetadata(
  saved: Pick<SavedReleaseMetadata, "title" | "description" | "tags">,
): boolean {
  return (
    saved.title.trim() !== "" ||
    saved.description.trim() !== "" ||
    saved.tags.length > 0
  );
}

/**
 * What the publish fields should open with.
 *
 * A saved release package wins over generated metadata, always. Generated text
 * is a starting point; a package is what a person decided and saved, and
 * overwriting it with a later generation would discard their editing without
 * asking. A package that has been created but never filled in is not a
 * decision, so it falls back rather than blanking the fields.
 */
export function createPublishingDraftsFromPackages(input: {
  packages: SavedReleaseMetadata[];
  generated: GeneratedPublishingMetadata[];
}): PublishingMetadataDraftMap {
  const drafts = createPublishingMetadataDraftMap(input.generated);
  for (const saved of input.packages) {
    if (!hasSavedReleaseMetadata(saved)) continue;
    drafts[saved.platform] = {
      title: saved.title,
      description: saved.description,
      tags: saved.tags.join(", "),
    };
  }
  return drafts;
}
