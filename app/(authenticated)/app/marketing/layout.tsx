import { notFound, redirect } from "next/navigation";
import { MarketingDisabledState } from "@/components/marketing/MarketingDisabledState";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { resolveMarketingAccess } from "@/lib/marketing/marketing-access";
import { can, canManageWorkspace } from "@/lib/policies/workspace-policy";

/**
 * Gates the whole Marketing Studio segment.
 *
 * Checked here rather than only in the sidebar, because hiding a link is not a
 * feature flag — the routes stay reachable by URL.
 *
 * Two switches with two different answers. `deployment_disabled` answers
 * `notFound()`, so an unreleased segment is indistinguishable from one that does
 * not exist. `workspace_disabled` renders an explanation instead, because the
 * feature does exist here and the user can do something about it; a 404 would
 * tell them to give up on something that is one toggle away.
 */
export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "useMarketingChat"))
    redirect("/app/access-denied");

  const access = await resolveMarketingAccess({
    workspaceId: context.activeMembership.workspaceId,
  });
  if (!access.available) {
    if (access.reason === "deployment_disabled") notFound();
    return (
      <MarketingDisabledState
        canManageSettings={canManageWorkspace(context.activeMembership.role)}
      />
    );
  }

  return <>{children}</>;
}
