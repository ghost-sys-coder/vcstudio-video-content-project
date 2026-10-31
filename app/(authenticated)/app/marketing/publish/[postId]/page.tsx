import { notFound, redirect } from "next/navigation";
import { PostComposer } from "@/components/social/PostComposer";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getMediaLibraryEnvironment } from "@/lib/env/server";
import { can } from "@/lib/policies/workspace-policy";
import { loadSocialPostComposerView } from "@/lib/social/load-social-posts";

export default async function MarketingPublishPostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "composePosts"))
    redirect("/app/access-denied");

  const workspaceId = context.activeMembership.workspaceId;
  const { postId } = await params;
  const limits = getMediaLibraryEnvironment();
  const view = await loadSocialPostComposerView({ workspaceId, postId });
  if (!view) notFound();

  return (
    <div className="min-w-0">
      <PostComposer
        canPublish={can(context.activeMembership.role, "publishPosts")}
        canUpload={can(context.activeMembership.role, "manageMediaLibrary")}
        composerBasePath="/app/marketing/publish"
        maxImageBytes={limits.MAX_MEDIA_IMAGE_BYTES}
        maxVideoBytes={limits.MAX_MEDIA_VIDEO_BYTES}
        view={view}
        workspaceId={workspaceId}
      />
    </div>
  );
}
