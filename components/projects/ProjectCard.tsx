import Link from "next/link";
import { CalendarClockIcon, WalletIcon } from "lucide-react";
import type { ProjectListItem } from "@/db/repositories/projects.repository";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { formatUsdCents } from "@/lib/format/currency";
import { formatShortDate } from "@/lib/format/date";

export function ProjectCard({ project }: { project: ProjectListItem }) {
  return (
    <Link
      className="group flex h-full min-w-0 flex-col rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition hover:-translate-y-0.5 hover:shadow-sm hover:ring-foreground/20"
      href={`/app/projects/${project.id}/script`}
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <h2
          className="min-w-0 flex-1 basis-40 truncate font-semibold group-hover:underline"
          title={project.name}
        >
          {project.name}
        </h2>
        <ProjectStatusBadge
          hasPublished={project.hasPublished}
          status={project.status}
        />
      </div>

      <p className="mt-3 line-clamp-2 min-h-10 min-w-0 flex-1 text-sm text-muted-foreground wrap-anywhere">
        {project.description || "No description yet."}
      </p>

      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
        <span>{project.aspectRatio}</span>
        <span>
          {project.width}×{project.height}
        </span>
        <span>{project.framesPerSecond} fps</span>
      </div>

      <div className="mt-4 flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-foreground/10 pt-3 text-xs text-muted-foreground">
        <span className="flex min-w-0 items-center gap-1.5 wrap-anywhere">
          <WalletIcon aria-hidden className="size-3.5 shrink-0" />
          {formatUsdCents(project.maximumBudgetCents)} budget
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <CalendarClockIcon aria-hidden className="size-3.5 shrink-0" />
          {formatShortDate(project.updatedAt)}
        </span>
      </div>
    </Link>
  );
}
