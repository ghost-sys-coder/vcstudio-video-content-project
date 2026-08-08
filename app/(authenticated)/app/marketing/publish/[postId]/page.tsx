import { notFound, redirect } from "next/navigation";
import { PostComposer } from "@/components/social/PostComposer";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getMediaLibraryEnvironment } from "@/lib/env/server";
import { loadMediaLibrary } from "@/lib/media/load-media-library";
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
  const [view, library] = await Promise.all([
    loadSocialPostComposerView({ workspaceId, postId }),
    loadMediaLibrary({ workspaceId }),
  ]);
  if (!view) notFound();

  return (
    <div className="p-6">
      <PostComposer
        canPublish={can(context.activeMembership.role, "publishPosts")}
        canUpload={can(context.activeMembership.role, "manageMediaLibrary")}
        composerBasePath="/app/marketing/publish"
        library={library.assets}
        maxImageBytes={limits.MAX_MEDIA_IMAGE_BYTES}
        maxVideoBytes={limits.MAX_MEDIA_VIDEO_BYTES}
        view={view}
        workspaceId={workspaceId}
      />
    </div>
  );
}
