import {
  socialYouTubeSettingsSchema,
  type SocialYouTubeSettings,
  YOUTUBE_THUMBNAIL_CONTENT_TYPES,
  YOUTUBE_THUMBNAIL_MAX_BYTES,
} from "@studio/contracts/publishing";

/** Identical effective metadata in browser previews, MCP approvals and workers. */
export function resolveYouTubePostSettings(
  settings: SocialYouTubeSettings | null | undefined,
  text: string,
): SocialYouTubeSettings {
  const value = settings ?? socialYouTubeSettingsSchema.parse({});
  return {
    ...value,
    title:
      value.title ||
      text.split(/\r?\n/, 1)[0]?.trim().slice(0, 100) ||
      "Untitled video",
    description: value.description ?? text,
  };
}

export function youTubeSettingsProblem(
  settings: SocialYouTubeSettings | null | undefined,
  text: string,
): string | null {
  const parsed = socialYouTubeSettingsSchema.safeParse(settings ?? {});
  if (!parsed.success)
    return (
      parsed.error.issues[0]?.message ?? "Check the YouTube upload settings."
    );
  const value = resolveYouTubePostSettings(parsed.data, text);
  if (value.madeForKids === null)
    return "Declare whether the YouTube video is made for kids.";
  if (value.containsSyntheticMedia === null)
    return "Declare whether the YouTube video contains realistic synthetic or altered content.";
  if ((value.description?.length ?? 0) > 5000)
    return "The YouTube description exceeds 5,000 characters.";
  return null;
}

export function youTubeThumbnailProblem(
  asset:
    | {
        kind: string;
        contentType: string;
        sizeBytes: number;
        width: number | null;
        height: number | null;
      }
    | null
    | undefined,
): string | null {
  if (!asset || asset.kind !== "image" || !asset.width || !asset.height)
    return "Choose a ready, decoded library image for the YouTube thumbnail.";
  if (
    !(YOUTUBE_THUMBNAIL_CONTENT_TYPES as readonly string[]).includes(
      asset.contentType,
    )
  )
    return "YouTube thumbnails must be JPEG or PNG images.";
  if (asset.sizeBytes > YOUTUBE_THUMBNAIL_MAX_BYTES)
    return "The YouTube thumbnail exceeds the 50 MB limit.";
  return null;
}
