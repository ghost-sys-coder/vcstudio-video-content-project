import type { ContentPlatform } from "@/db/schema";

export const PUBLISHING_METADATA_UPDATED_EVENT =
  "vcstudio:publishing-metadata-updated";

export type GeneratedPublishingMetadata = {
  generationRunId: string;
  platform: ContentPlatform;
  title: string;
  description: string;
  tags: string[];
};

export type PublishingMetadataDraft = {
  title: string;
  description: string;
  tags: string;
};

export type PublishingMetadataDraftMap = Record<
  ContentPlatform,
  PublishingMetadataDraft
>;

export const EMPTY_PUBLISHING_METADATA_DRAFT: PublishingMetadataDraft = {
  title: "",
  description: "",
  tags: "",
};

export function normalizeGeneratedTags(tags: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const value of tags) {
    const tag = value.replace(/^#+/, "").replace(/\s+/g, " ").trim();
    if (tag === "" || tag.length > 30) continue;
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(tag);
    if (normalized.length === 15) break;
  }
  return normalized;
}

export function selectPreferredGeneratedTitle(
  suggestions: {
    text: string;
    position: number;
    isFavorite: boolean;
  }[],
): string {
  return (
    [...suggestions].sort(
      (left, right) =>
        Number(right.isFavorite) - Number(left.isFavorite) ||
        left.position - right.position,
    )[0]?.text ?? ""
  );
}

export function toPublishingMetadataDraft(
  metadata: GeneratedPublishingMetadata | undefined,
): PublishingMetadataDraft {
  if (!metadata) return { ...EMPTY_PUBLISHING_METADATA_DRAFT };
  return {
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags.join(", "),
  };
}

export function createPublishingMetadataDraftMap(
  metadata: GeneratedPublishingMetadata[],
): PublishingMetadataDraftMap {
  const byPlatform = new Map(
    metadata.map((entry) => [entry.platform, entry] as const),
  );
  return {
    youtube: toPublishingMetadataDraft(byPlatform.get("youtube")),
    facebook: toPublishingMetadataDraft(byPlatform.get("facebook")),
    instagram: toPublishingMetadataDraft(byPlatform.get("instagram")),
    tiktok: toPublishingMetadataDraft(byPlatform.get("tiktok")),
  };
}

export function createPublishingMetadataSignatures(
  metadata: GeneratedPublishingMetadata[],
): Map<ContentPlatform, string> {
  return new Map(
    metadata.map((entry) => [
      entry.platform,
      `${entry.generationRunId}:${entry.title}`,
    ]),
  );
}

export function hydrateUntouchedPublishingMetadata(input: {
  drafts: PublishingMetadataDraftMap;
  generatedMetadata: GeneratedPublishingMetadata[];
  touchedPlatforms: ReadonlySet<ContentPlatform>;
  hydratedSignatures: ReadonlyMap<ContentPlatform, string>;
}): {
  drafts: PublishingMetadataDraftMap;
  hydratedSignatures: Map<ContentPlatform, string>;
} {
  const drafts = { ...input.drafts };
  const hydratedSignatures = new Map(input.hydratedSignatures);
  for (const metadata of input.generatedMetadata) {
    const signature = `${metadata.generationRunId}:${metadata.title}`;
    if (input.touchedPlatforms.has(metadata.platform)) continue;
    if (hydratedSignatures.get(metadata.platform) === signature) continue;
    drafts[metadata.platform] = toPublishingMetadataDraft(metadata);
    hydratedSignatures.set(metadata.platform, signature);
  }
  return { drafts, hydratedSignatures };
}

export function composeHashtagCaption(draft: PublishingMetadataDraft): string {
  const tags = normalizeGeneratedTags(draft.tags.split(","));
  const hashtagLine = tags
    .map((tag) => `#${tag.replace(/\s+/g, "")}`)
    .join(" ");
  return [draft.description.trim(), hashtagLine].filter(Boolean).join("\n\n");
}
