import type {
  ProjectScriptVersion,
  Scene,
  SceneAnalysisRun,
  SceneVersion,
  Character,
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
  availableCharacters,
  projectAspectRatio,
  canGenerateImages,
  canReviewImages,
}: {
  projectId: string;
  approvedVersion: ProjectScriptVersion | null;
  latestRun: SceneAnalysisRun | null;
  rows: Array<{
    scene: Scene;
    version: SceneVersion;
    assignedCharacters: Character[];
  }>;
  estimatedCostCents: number;
  canEdit: boolean;
  initialSceneNumber: number | null;
  availableCharacters: Character[];
  projectAspectRatio: "16:9" | "9:16" | "1:1";
  canGenerateImages: boolean;
  canReviewImages: boolean;
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
        availableCharacters={availableCharacters}
        projectAspectRatio={projectAspectRatio}
        canGenerateImages={canGenerateImages}
        canReviewImages={canReviewImages}
      />
    </div>
  );
}
