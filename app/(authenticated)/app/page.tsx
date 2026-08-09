import { DashboardOverview } from "@/components/application/DashboardOverview";
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
  const [statistics, recentProjects, firstValueFacts] = await Promise.all([
    getWorkspaceDashboardStatistics({ workspaceId }),
    listProjects({ workspaceId, page: 1, pageSize: 5 }),
    loadFirstValueFacts(workspaceId),
  ]);

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
