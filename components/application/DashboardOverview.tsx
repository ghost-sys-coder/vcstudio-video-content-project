import {
  FolderKanbanIcon,
  ImagesIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import type { WorkspaceMembershipView } from "@/db/repositories/workspaces.repository";
import type { WorkspaceDashboardStatistics } from "@/db/repositories/dashboard.repository";
import type { ProjectListItem } from "@/db/repositories/projects.repository";
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
  recentProjects: ProjectListItem[];
}) {
  return (
    <section aria-labelledby="dashboard-heading" className="space-y-8">
      <div className="relative overflow-hidden rounded-3xl bg-[oklch(0.25_0.06_174)] px-6 py-7 text-[oklch(0.97_0.02_105)] shadow-xl sm:px-8 sm:py-9">
        <span
          aria-hidden
          className="absolute -right-12 -top-16 size-48 rounded-full border-[28px] border-primary/15"
        />
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-white/60">
          {membership.role} workspace
        </p>
        <h1
          className="font-display mt-2 text-4xl leading-none tracking-tight sm:text-5xl"
          id="dashboard-heading"
        >
          {membership.workspaceName}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-white/70 sm:text-base">
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
