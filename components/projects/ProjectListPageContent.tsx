import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Project } from "@/db/schema";
import { buttonVariants } from "@/components/ui/button";
import { CreateProjectDialog } from "@/components/projects/CreateProjectDialog";
import { EmptyProjectsState } from "@/components/projects/EmptyProjectsState";
import { ProjectCard } from "@/components/projects/ProjectCard";
import type { IdeaNicheGroup } from "@/lib/ideas/ideas-view";
import { cn } from "@/lib/utils";

export function ProjectListPageContent({
  projects,
  total,
  page,
  pageCount,
  canCreate,
  defaultBudgetCents,
  ideaGroups,
  initialIdeaId,
}: {
  projects: Project[];
  total: number;
  page: number;
  pageCount: number;
  canCreate: boolean;
  defaultBudgetCents: number;
  ideaGroups: IdeaNicheGroup[];
  initialIdeaId?: string | null;
}) {
  return (
    <section className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Production
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Projects
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Turn narration scripts into structured scenes, imagery, and rendered
            video.
            {total > 0 ? (
              <span className="ml-1 text-foreground">
                {total} {total === 1 ? "project" : "projects"}.
              </span>
            ) : null}
          </p>
        </div>
        {canCreate ? (
          <CreateProjectDialog
            defaultBudgetCents={defaultBudgetCents}
            ideaGroups={ideaGroups}
            initialIdeaId={initialIdeaId}
          />
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

      {pageCount > 1 ? (
        <nav
          aria-label="Project pages"
          className="flex items-center justify-between gap-2"
        >
          <p className="text-xs text-muted-foreground">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Link
              aria-disabled={page <= 1}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                page <= 1 && "pointer-events-none opacity-50",
              )}
              href={`/app/projects?page=${page - 1}`}
            >
              <ChevronLeftIcon aria-hidden />
              Previous
            </Link>
            <Link
              aria-disabled={page >= pageCount}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                page >= pageCount && "pointer-events-none opacity-50",
              )}
              href={`/app/projects?page=${page + 1}`}
            >
              Next
              <ChevronRightIcon aria-hidden />
            </Link>
          </div>
        </nav>
      ) : null}
    </section>
  );
}
