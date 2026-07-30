import { redirect } from "next/navigation";
import { SocialPostsWorkspace } from "@/components/social/SocialPostsWorkspace";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadSocialPostsView } from "@/lib/social/load-social-posts";
import { can } from "@/lib/policies/workspace-policy";

export default async function SocialPostsPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "composePosts"))
    redirect("/app/access-denied");

  const posts = await loadSocialPostsView({
    workspaceId: context.activeMembership.workspaceId,
  });

  return (
    <SocialPostsWorkspace
      canCompose={can(context.activeMembership.role, "composePosts")}
      posts={posts}
    />
  );
}
