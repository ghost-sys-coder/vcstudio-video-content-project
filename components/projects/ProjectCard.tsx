import Link from "next/link";
import type { Project } from "@/db/schema";
import { ProjectStatusBadge } from "@/components/projects/ProjectStatusBadge";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      className="group rounded-2xl border bg-background p-5 transition hover:-translate-y-0.5 hover:shadow-md"
      href={`/app/projects/${project.id}/script`}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold group-hover:underline">{project.name}</h2>
        <ProjectStatusBadge status={project.status} />
      </div>
      <p className="mt-3 line-clamp-2 min-h-10 text-sm text-muted-foreground">
        {project.description || "No description yet."}
      </p>
      <div className="mt-5 flex gap-3 font-mono text-xs text-muted-foreground">
        <span>{project.aspectRatio}</span>
        <span>
          {project.width}×{project.height}
        </span>
        <span>{project.framesPerSecond} fps</span>
      </div>
    </Link>
  );
}
