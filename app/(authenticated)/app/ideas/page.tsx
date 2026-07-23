import { redirect } from "next/navigation";
import { IdeaLabWorkspace } from "@/components/ideas/IdeaLabWorkspace";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadIdeaLabView } from "@/lib/ideas/ideas-view";
import { can } from "@/lib/policies/workspace-policy";

export default async function IdeasPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");

  const view = await loadIdeaLabView({
    workspaceId: context.activeMembership.workspaceId,
  });
  const canEdit = can(context.activeMembership.role, "mutateWorkspaceData");

  return <IdeaLabWorkspace canEdit={canEdit} view={view} />;
}
