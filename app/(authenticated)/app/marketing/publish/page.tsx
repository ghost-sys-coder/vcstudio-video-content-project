import { redirect } from "next/navigation";
import { SocialPostsWorkspace } from "@/components/social/SocialPostsWorkspace";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can } from "@/lib/policies/workspace-policy";
import { loadSocialPostsView } from "@/lib/social/load-social-posts";

export default async function MarketingPublishPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "composePosts"))
    redirect("/app/access-denied");

  const posts = await loadSocialPostsView({
    workspaceId: context.activeMembership.workspaceId,
  });

  return (
    <div className="p-6">
      <SocialPostsWorkspace
        canCompose={can(context.activeMembership.role, "composePosts")}
        composerBasePath="/app/marketing/publish"
        posts={posts}
      />
    </div>
  );
}
