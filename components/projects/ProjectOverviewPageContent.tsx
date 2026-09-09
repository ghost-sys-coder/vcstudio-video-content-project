import { ProductionBlockerList } from "@/components/production/ProductionBlockerList";
import { ProductionReleaseBadge } from "@/components/production/ProductionReleaseBadge";
import { ProductionReviewList } from "@/components/production/ProductionReviewList";
import { ProjectPrimaryAction } from "@/components/projects/ProjectPrimaryAction";
import { ProjectResourceLinks } from "@/components/projects/ProjectResourceLinks";
import { ProjectStageProgress } from "@/components/projects/ProjectStageProgress";
import type { ProductionReadiness } from "@/lib/production/production-readiness";
import { describeStageProgress } from "@/lib/production/production-stages";

/**
 * The project's starting point: where it stands, what is holding it up, and
 * the one next step. Everything on it is read-only navigation.
 */
export function ProjectOverviewPageContent({
  projectId,
  readiness,
}: {
  projectId: string;
  readiness: ProductionReadiness;
}) {
  const outstanding =
    readiness.blockers.length > 0 || readiness.reviews.length > 0;

  return (
    <section aria-labelledby="project-overview-heading" className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold" id="project-overview-heading">
          Overview
        </h2>
        <ProductionReleaseBadge state={readiness.releaseState} />
      </div>

      <ProjectStageProgress
        projectId={projectId}
        steps={describeStageProgress(readiness.stage)}
      />

      <ProjectPrimaryAction projectId={projectId} readiness={readiness} />

      {outstanding ? (
        <section aria-labelledby="project-outstanding-heading">
          <h2
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            id="project-outstanding-heading"
          >
            Outstanding
          </h2>
          <div className="mt-2 space-y-1 rounded-xl border p-3">
            <ProductionBlockerList
              blockers={readiness.blockers}
              projectId={projectId}
            />
            <ProductionReviewList
              projectId={projectId}
              reviews={readiness.reviews}
            />
          </div>
        </section>
      ) : null}

      <ProjectResourceLinks />
    </section>
  );
}
