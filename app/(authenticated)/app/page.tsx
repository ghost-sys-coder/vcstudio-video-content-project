import { randomUUID } from "node:crypto";
import { DashboardOverview } from "@/components/application/DashboardOverview";
import { DashboardUnavailableState } from "@/components/application/DashboardUnavailableState";
import { FirstValueOnboardingPanel } from "@/components/onboarding/FirstValueOnboardingPanel";
import { loadFirstValueFacts } from "@/db/repositories/first-value-onboarding.repository";
import { getWorkspaceDashboardStatistics } from "@/db/repositories/dashboard.repository";
import { listProjects } from "@/db/repositories/projects.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { buildFirstValueTracks } from "@/lib/onboarding/first-value-onboarding";

export default async function DashboardPage() {
  const context = await getAuthenticatedWorkspaceContext();

  if (!context) {
    return null;
  }

  const workspaceId = context.activeMembership.workspaceId;
  let dashboardData: Awaited<ReturnType<typeof loadWorkspaceDashboardData>>;
  try {
    dashboardData = await loadWorkspaceDashboardData(workspaceId);
  } catch (error) {
    const supportReference = `dashboard-${randomUUID().slice(0, 8)}`;
    console.error("Workspace dashboard data load failed.", {
      supportReference,
      error,
    });
    return <DashboardUnavailableState supportReference={supportReference} />;
  }

  const { statistics, recentProjects, firstValueFacts } = dashboardData;

  const tracks = buildFirstValueTracks({
    facts: firstValueFacts,
    role: context.activeMembership.role,
    marketingEnabled: process.env.ENABLE_MARKETING_STUDIO !== "false",
    publishingEnabled: process.env.ENABLE_SOCIAL_POSTING !== "false",
  });

  return (
    <div className="space-y-8">
      <FirstValueOnboardingPanel tracks={tracks} />
      <DashboardOverview
        membership={context.activeMembership}
        recentProjects={recentProjects.items}
        statistics={statistics}
      />
    </div>
  );
}

async function loadWorkspaceDashboardData(workspaceId: string) {
  const [statistics, recentProjects, firstValueFacts] = await Promise.all([
    getWorkspaceDashboardStatistics({ workspaceId }),
    listProjects({ workspaceId, page: 1, pageSize: 5 }),
    loadFirstValueFacts(workspaceId),
  ]);
  return { statistics, recentProjects, firstValueFacts };
}
