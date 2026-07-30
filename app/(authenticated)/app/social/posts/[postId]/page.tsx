import { notFound, redirect } from "next/navigation";
import { PostComposer } from "@/components/social/PostComposer";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadMediaLibrary } from "@/lib/media/load-media-library";
import { loadSocialPostComposerView } from "@/lib/social/load-social-posts";
import { can } from "@/lib/policies/workspace-policy";

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

  const [view, library] = await Promise.all([
    loadSocialPostComposerView({ workspaceId, postId }),
    loadMediaLibrary({ workspaceId }),
  ]);
  // Null covers both "does not exist" and "belongs to another workspace" — the
  // repository is workspace-scoped, so a foreign id is indistinguishable from a
  // missing one, which is the point.
  if (!view) notFound();

  return (
    <PostComposer
      canPublish={can(context.activeMembership.role, "publishPosts")}
      library={library.assets}
      view={view}
    />
  );
}
