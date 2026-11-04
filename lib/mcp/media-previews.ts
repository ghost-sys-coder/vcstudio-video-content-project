import "server-only";
import type { PublicationPreview } from "@studio/contracts";
import { listSocialPostMedia } from "@/db/repositories/social-posts.repository";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";
import { requireMcp } from "./errors";
export type McpMediaPreview = { id: string; kind: string; url: string };
/** Ephemeral UI data only; never persist these URLs or put them in model text. */
export async function loadMcpMediaPreviews(
  workspaceId: string,
  preview: PublicationPreview,
): Promise<McpMediaPreview[]> {
  const media = await listSocialPostMedia({
    workspaceId,
    postId: preview.postId,
  });
  return Promise.all(
    media
      .filter((a) => preview.media.some((m) => m.id === a.sourceId))
      .map(async (a) => {
        requireMcp(
          a.objectKey.startsWith(`workspaces/${workspaceId}/`) &&
            !a.unavailable,
          "invalid_media",
          "This preview asset is unavailable.",
        );
        return {
          id: a.sourceId,
          kind: a.kind,
          url: await createMediaAssetDownloadUrl(a.objectKey, 600),
        };
      }),
  );
}
