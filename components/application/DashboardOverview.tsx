import {
  FolderKanbanIcon,
  ImagesIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import type { Project } from "@/db/schema";
import type { WorkspaceMembershipView } from "@/db/repositories/workspaces.repository";
import type { WorkspaceDashboardStatistics } from "@/db/repositories/dashboard.repository";
import { DashboardRecentProjects } from "@/components/application/DashboardRecentProjects";
import { DashboardStatCard } from "@/components/application/DashboardStatCard";
import { formatUsdCents } from "@/lib/format/currency";

export function DashboardOverview({
  membership,
  statistics,
  recentProjects,
}: {
  membership: WorkspaceMembershipView;
  statistics: WorkspaceDashboardStatistics;
  recentProjects: Project[];
}) {
  return (
    <section aria-labelledby="dashboard-heading" className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          {membership.role} workspace
        </p>
        <h1
          className="mt-2 text-3xl font-semibold tracking-tight"
          id="dashboard-heading"
        >
          {membership.workspaceName}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          An overview of your production workspace — projects in flight,
          characters, generated scene imagery, and this month&rsquo;s spend.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardStatCard
          detail={
            statistics.projects.active > 0
              ? `${statistics.projects.active} active`
              : "No projects in progress"
          }
          href="/app/projects"
          icon={FolderKanbanIcon}
          label="Projects"
          value={statistics.projects.total.toLocaleString()}
        />
        <DashboardStatCard
          detail={
            statistics.characters.total > 0
              ? "In your character library"
              : "No characters yet"
          }
          href="/app/characters"
          icon={UsersIcon}
          label="Characters"
          value={statistics.characters.total.toLocaleString()}
        />
        <DashboardStatCard
          accent
          detail={
            statistics.sceneImages.awaitingReview > 0
              ? `${statistics.sceneImages.awaitingReview} awaiting review`
              : "None awaiting review"
          }
          icon={ImagesIcon}
          label="Scene images"
          value={statistics.sceneImages.succeeded.toLocaleString()}
        />
        <DashboardStatCard
          detail="Image generation this month"
          icon={WalletIcon}
          label="Spend to date"
          value={formatUsdCents(statistics.spend.monthToDateCents)}
        />
      </div>

      <DashboardRecentProjects projects={recentProjects} />
    </section>
  );
}
