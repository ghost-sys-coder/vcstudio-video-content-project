import { DashboardOverview } from "@/components/application/DashboardOverview";
import { getWorkspaceDashboardStatistics } from "@/db/repositories/dashboard.repository";
import { listProjects } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";

export default async function DashboardPage() {
  const context = await getAuthenticatedWorkspaceContext();

  if (!context) {
    return null;
  }

  const workspaceId = context.activeMembership.workspaceId;
  const [statistics, recentProjects] = await Promise.all([
    getWorkspaceDashboardStatistics({ workspaceId }),
    listProjects({ workspaceId, page: 1, pageSize: 5 }),
  ]);

  return (
    <DashboardOverview
      membership={context.activeMembership}
      recentProjects={recentProjects.items}
      statistics={statistics}
    />
  );
}
