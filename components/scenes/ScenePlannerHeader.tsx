import { AnalysisCostDialog } from "@/components/scenes/AnalysisCostDialog";
import { ApproveAllScenesDialog } from "@/components/scenes/ApproveAllScenesDialog";
import { CreateSceneDialog } from "@/components/scenes/CreateSceneDialog";

export function ScenePlannerHeader({
  projectId,
  approvedVersionId,
  approvedVersionNumber,
  estimatedCostCents,
  canEdit,
  hasScenes,
  manualPlan,
  analysisActive,
}: {
  projectId: string;
  approvedVersionId: string | null;
  approvedVersionNumber: number | null;
  estimatedCostCents: number;
  canEdit: boolean;
  hasScenes: boolean;
  manualPlan: boolean;
  analysisActive: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold">Scene planner</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {manualPlan
            ? approvedVersionNumber
              ? `These scenes are manually authored. Approved script version ${approvedVersionNumber} is available for AI analysis.`
              : "These scenes are manually authored; no script is needed."
            : approvedVersionNumber
              ? `Using approved script version ${approvedVersionNumber}.`
              : "Create scenes yourself, or approve a script to use AI analysis."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {canEdit && hasScenes && !analysisActive ? (
          <CreateSceneDialog projectId={projectId} />
        ) : null}
        <AnalysisCostDialog
          disabled={!canEdit || !approvedVersionId || analysisActive}
          estimatedCostCents={estimatedCostCents}
          hasScenes={hasScenes}
          projectId={projectId}
          scriptVersionId={approvedVersionId}
        />
        <ApproveAllScenesDialog
          disabled={!canEdit || !hasScenes}
          projectId={projectId}
        />
      </div>
    </header>
  );
}
