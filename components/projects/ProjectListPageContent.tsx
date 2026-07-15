import Link from "next/link";
import type { Project } from "@/db/schema";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { EmptyProjectsState } from "@/components/projects/EmptyProjectsState";
import { ProjectCard } from "@/components/projects/ProjectCard";

export function ProjectListPageContent({
  projects,
  page,
  pageCount,
  canCreate,
  defaultBudgetCents,
}: {
  projects: Project[];
  page: number;
  pageCount: number;
  canCreate: boolean;
  defaultBudgetCents: number;
}) {
  return (
    <section>
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Production
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Projects</h1>
        </div>
        {canCreate ? (
          <CreateProjectDialog defaultBudgetCents={defaultBudgetCents} />
        ) : null}
      </div>
      {projects.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyProjectsState />
      )}
      <nav aria-label="Project pages" className="mt-8 flex justify-end gap-2">
        {page > 1 ? (
          <Link
            className="rounded-lg border px-3 py-2 text-sm"
            href={`/app/projects?page=${page - 1}`}
          >
            Previous
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link
            className="rounded-lg border px-3 py-2 text-sm"
            href={`/app/projects?page=${page + 1}`}
          >
            Next
          </Link>
        ) : null}
      </nav>
    </section>
  );
}
