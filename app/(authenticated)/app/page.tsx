import { DashboardPlaceholder } from "@/components/application/DashboardPlaceholder";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";

export default async function DashboardPage() {
  const context = await getAuthenticatedWorkspaceContext();

  if (!context) {
    return null;
  }

  return <DashboardPlaceholder membership={context.activeMembership} />;
}
