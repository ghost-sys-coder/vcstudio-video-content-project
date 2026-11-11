import { ProductionRunPanel } from "@/components/production-runs/ProductionRunPanel";
import type { VoicePresetOption } from "@/components/production-runs/StartProductionRunDialog";
import { ProductionBlockerList } from "@/components/production/ProductionBlockerList";
import { ProductionReleaseBadge } from "@/components/production/ProductionReleaseBadge";
import { ProductionReviewList } from "@/components/production/ProductionReviewList";
import { ProjectPrimaryAction } from "@/components/projects/ProjectPrimaryAction";
import { ProjectResourceLinks } from "@/components/projects/ProjectResourceLinks";
import { ProjectStageProgress } from "@/components/projects/ProjectStageProgress";
import type { ProductionReadiness } from "@/lib/production/production-readiness";
import { describeStageProgress } from "@/lib/production/production-stages";
import type { ProductionRunPanelView } from "@/lib/production-runs/production-run-view";

/**
 * The project's starting point: where it stands, what is holding it up, and
 * the one next step. The readiness section is read-only navigation; the only
 * thing on this page that can spend is the explicit, cost-stated run dialog.
 */
export function ProjectOverviewPageContent({
  canRunProduction,
  productionRun,
  projectBudgetCents,
  projectId,
  readiness,
  voicePresets,
}: {
  canRunProduction: boolean;
  productionRun: ProductionRunPanelView;
  projectBudgetCents: number;
  projectId: string;
  readiness: ProductionReadiness;
  voicePresets: VoicePresetOption[];
}) {
  const outstanding =
    readiness.blockers.length > 0 || readiness.reviews.length > 0;

  return (
    <section aria-labelledby="project-overview-heading" className="app-page">
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

      <ProductionRunPanel
        canRun={canRunProduction}
        panel={productionRun}
        projectBudgetCents={projectBudgetCents}
        projectId={projectId}
        voicePresets={voicePresets}
      />

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
