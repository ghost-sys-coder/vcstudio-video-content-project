import Link from "next/link";
import { CalendarClockIcon, WalletIcon } from "lucide-react";
import type { Project } from "@/db/schema";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";
import { formatUsdCents } from "@/lib/format/currency";
import { formatShortDate } from "@/lib/format/date";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      className="group flex h-full flex-col rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition hover:-translate-y-0.5 hover:shadow-sm hover:ring-foreground/20"
      href={`/app/projects/${project.id}/script`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 truncate font-semibold group-hover:underline">
          {project.name}
        </h2>
        <ProjectStatusBadge status={project.status} />
      </div>

      <p className="mt-3 line-clamp-2 min-h-10 flex-1 text-sm text-muted-foreground">
        {project.description || "No description yet."}
      </p>

      <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-muted-foreground">
        <span>{project.aspectRatio}</span>
        <span>
          {project.width}×{project.height}
        </span>
        <span>{project.framesPerSecond} fps</span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-foreground/10 pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <WalletIcon aria-hidden className="size-3.5" />
          {formatUsdCents(project.maximumBudgetCents)} budget
        </span>
        <span className="flex items-center gap-1.5">
          <CalendarClockIcon aria-hidden className="size-3.5" />
          {formatShortDate(project.updatedAt)}
        </span>
      </div>
    </Link>
  );
}
