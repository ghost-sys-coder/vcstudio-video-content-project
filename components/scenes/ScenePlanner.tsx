import type {
  ProjectScriptVersion,
  Scene,
  SceneAnalysisRun,
  SceneVersion,
} from "@/db/schema";
import { ScenePlannerHeader } from "@/components/scenes/ScenePlannerHeader";
import { AnalysisProgressPanel } from "@/components/scenes/AnalysisProgressPanel";
import { SceneAnalysisErrorState } from "@/components/scenes/SceneAnalysisErrorState";
import { SceneList } from "@/components/scenes/SceneList";

export function ScenePlanner({
  projectId,
  approvedVersion,
  latestRun,
  rows,
  estimatedCostCents,
  canEdit,
  initialSceneNumber,
}: {
  projectId: string;
  approvedVersion: ProjectScriptVersion | null;
  latestRun: SceneAnalysisRun | null;
  rows: Array<{ scene: Scene; version: SceneVersion }>;
  estimatedCostCents: number;
  canEdit: boolean;
  initialSceneNumber: number | null;
}) {
  const active = latestRun
    ? ["pending", "queued", "running"].includes(latestRun.status)
    : false;
  return (
    <div className="space-y-6">
      <ScenePlannerHeader
        analysisActive={active}
        approvedVersionId={approvedVersion?.id ?? null}
        approvedVersionNumber={approvedVersion?.versionNumber ?? null}
        canEdit={canEdit}
        estimatedCostCents={estimatedCostCents}
        hasScenes={rows.length > 0}
        projectId={projectId}
      />
      {latestRun && active ? <AnalysisProgressPanel run={latestRun} /> : null}
      {latestRun?.status === "failed" ? (
        <SceneAnalysisErrorState run={latestRun} />
      ) : null}
      <SceneList
        canEdit={canEdit}
        initialSceneNumber={initialSceneNumber}
        rows={rows}
      />
    </div>
  );
}
