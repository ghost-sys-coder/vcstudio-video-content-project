import "server-only";
import { saveSocialPostSchema } from "@/lib/schemas/social-post";
import { findDraftAttachableMediaAssets } from "@/db/repositories/media-assets.repository";
import { findPublishableRenders } from "@/db/repositories/video-render.repository";
import { updateSocialPostDraft } from "@/db/commands/social-post-commands";
import { renderPortableDocumentToPlainText } from "@/lib/social/render-plain-text";
import { requireCapability } from "@/lib/policies/workspace-policy";
import type { WorkspaceRole } from "@/db/schema";
import { findSocialPostDestinationConnections } from "@/db/repositories/social-post-destinations.repository";
import { isSocialPostPlatform } from "./platform-post-capabilities";
import { SocialDraftDestinationError } from "./social-draft-error";

/** Shared web/MCP save boundary; callers resolve the user's membership first. */
export async function saveAuthorizedSocialDraft(
  context: { workspaceId: string; role: WorkspaceRole },
  raw: unknown,
) {
  requireCapability(context.role, "composePosts");
  const input = saveSocialPostSchema.parse(raw);
  if (input.connectionIds !== undefined) {
    const connections = await findSocialPostDestinationConnections({
      workspaceId: context.workspaceId,
      connectionIds: input.connectionIds,
    });
    if (
      connections.length !== input.connectionIds.length ||
      connections.some(
        (connection) => !isSocialPostPlatform(connection.platform),
      )
    )
      throw new SocialDraftDestinationError();
  }
  const libraryIds = input.attachments
    .filter((a) => a.source === "library")
    .map((a) => a.id);
  const renderIds = input.attachments
    .filter((a) => a.source === "render")
    .map((a) => a.id);
  const [assets, renders] = await Promise.all([
    findDraftAttachableMediaAssets({
      workspaceId: context.workspaceId,
      mediaAssetIds: libraryIds,
    }),
    findPublishableRenders({ workspaceId: context.workspaceId, renderIds }),
  ]);
  if (
    assets.length !== libraryIds.length ||
    renders.length !== renderIds.length
  )
    throw new Error("POST_MEDIA_UNAVAILABLE");
  const plainText = renderPortableDocumentToPlainText(input.bodyDocument);
  return updateSocialPostDraft({
    ...input,
    workspaceId: context.workspaceId,
    bodyPlainText: plainText,
  });
}
