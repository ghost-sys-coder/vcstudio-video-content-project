import "server-only";
import type { PublicationPreview } from "@studio/contracts";
import { listSocialPostMedia } from "@/db/repositories/social-posts.repository";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";
import { requireMcp } from "./errors";
export type McpMediaPreview = { id: string; kind: string; url: string };
/** Resolve bucket-host/path-style addressing through the same signer as previews.
 * Signing is local: no object is fetched and the temporary URL is never returned.
 */
export async function getMcpMediaPreviewOrigin(): Promise<string> {
  return new URL(
    await createMediaAssetDownloadUrl("mcp-preview-origin-check", 60),
  ).origin;
}
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
