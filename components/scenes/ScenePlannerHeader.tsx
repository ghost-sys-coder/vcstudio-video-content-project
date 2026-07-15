import { AnalysisCostDialog } from "@/components/scenes/AnalysisCostDialog";
import { ApproveAllScenesDialog } from "@/components/scenes/ApproveAllScenesDialog";

export function ScenePlannerHeader({
  projectId,
  approvedVersionId,
  approvedVersionNumber,
  estimatedCostCents,
  canEdit,
  hasScenes,
  analysisActive,
}: {
  projectId: string;
  approvedVersionId: string | null;
  approvedVersionNumber: number | null;
  estimatedCostCents: number;
  canEdit: boolean;
  hasScenes: boolean;
  analysisActive: boolean;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold">Scene planner</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {approvedVersionNumber
            ? `Using approved script version ${approvedVersionNumber}.`
            : "Approve a script version before requesting analysis."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <AnalysisCostDialog
          disabled={!canEdit || !approvedVersionId || analysisActive}
          estimatedCostCents={estimatedCostCents}
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
