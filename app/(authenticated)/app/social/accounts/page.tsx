import { redirect } from "next/navigation";
import { WorkspaceChannelsSection } from "@/components/workspace/WorkspaceChannelsSection";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can, canManageWorkspace } from "@/lib/policies/workspace-policy";
import { loadWorkspaceChannelsView } from "@/lib/publishing/workspace-connections-view";
import { connectionOAuthQuerySchema } from "@/lib/schemas/connection-oauth";

export default async function SocialAccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "composePosts"))
    redirect("/app/access-denied");

  const [channelsView, query] = await Promise.all([
    loadWorkspaceChannelsView({
      workspaceId: context.activeMembership.workspaceId,
    }),
    searchParams,
  ]);

  return (
    <WorkspaceChannelsSection
      canManageConnections={canManageWorkspace(context.activeMembership.role)}
      initialData={channelsView}
      oauthStatus={connectionOAuthQuerySchema.parse(query)}
    />
  );
}
