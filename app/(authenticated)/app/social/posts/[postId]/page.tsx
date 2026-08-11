import { notFound, redirect } from "next/navigation";
import { PostComposer } from "@/components/social/PostComposer";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadMediaLibrary } from "@/lib/media/load-media-library";
import { getMediaLibraryEnvironment } from "@/lib/env/server";
import { loadSocialPostComposerView } from "@/lib/social/load-social-posts";
import { can } from "@/lib/policies/workspace-policy";
import { findCampaignConnectionForSocialPost } from "@/db/repositories/marketing-content.repository";

export default async function SocialPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "composePosts"))
    redirect("/app/access-denied");

  const { postId } = await params;
  const workspaceId = context.activeMembership.workspaceId;
  const limits = getMediaLibraryEnvironment();

  const [view, library, campaignConnectionId] = await Promise.all([
    loadSocialPostComposerView({ workspaceId, postId }),
    loadMediaLibrary({ workspaceId }),
    findCampaignConnectionForSocialPost({ workspaceId, socialPostId: postId }),
  ]);
  // Null covers both "does not exist" and "belongs to another workspace" — the
  // repository is workspace-scoped, so a foreign id is indistinguishable from a
  // missing one, which is the point.
  if (!view) notFound();
  const campaignView = campaignConnectionId
    ? {
        ...view,
        availableConnections: view.availableConnections.filter(
          (connection) => connection.id === campaignConnectionId,
        ),
      }
    : view;

  return (
    <PostComposer
      canPublish={can(context.activeMembership.role, "publishPosts")}
      canUpload={can(context.activeMembership.role, "manageMediaLibrary")}
      library={library.assets}
      maxImageBytes={limits.MAX_MEDIA_IMAGE_BYTES}
      maxVideoBytes={limits.MAX_MEDIA_VIDEO_BYTES}
      view={campaignView}
      workspaceId={workspaceId}
    />
  );
}
