import Link from "next/link";
import { ArrowRightIcon, FolderIcon } from "lucide-react";
import type { Project } from "@/db/schema";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

export function DashboardRecentProjects({ projects }: { projects: Project[] }) {
  return (
    <section
      aria-labelledby="dashboard-recent-projects-heading"
      className="rounded-xl bg-card ring-1 ring-foreground/10"
    >
      <div className="flex items-center justify-between border-b border-foreground/10 px-5 py-4">
        <h2
          className="text-sm font-medium"
          id="dashboard-recent-projects-heading"
        >
          Recent projects
        </h2>
        <Link
          className="flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
          href="/app/projects"
        >
          View all
          <ArrowRightIcon aria-hidden className="size-3.5" />
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FolderIcon aria-hidden className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium">No projects yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create your first project to start turning scripts into scenes.
            </p>
          </div>
          <Link
            className="mt-1 text-xs font-medium text-primary hover:underline"
            href="/app/projects"
          >
            Go to projects
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-foreground/10">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-muted/50"
                href={`/app/projects/${project.id}/script`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {project.aspectRatio} · Updated{" "}
                    {dateFormatter.format(project.updatedAt)}
                  </p>
                </div>
                <ProjectStatusBadge status={project.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
