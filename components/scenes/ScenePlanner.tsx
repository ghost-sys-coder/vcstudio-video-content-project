import type {
  ProjectScriptVersion,
  Scene,
  SceneAnalysisRun,
  SceneVersion,
  Character,
  ProjectVideoKind,
} from "@/db/schema";
import type { SceneImageIndicator } from "@/lib/scenes/scene-image-indicator";
import type { SceneCharacterStaging } from "@/lib/scenes/scene-character-staging";
import type { ScriptCoverageView } from "@/lib/scenes/script-coverage-view";
import { ScenePlannerHeader } from "@/components/scenes/ScenePlannerHeader";
import { AnalysisProgressPanel } from "@/components/scenes/AnalysisProgressPanel";
import { SceneAnalysisErrorState } from "@/components/scenes/SceneAnalysisErrorState";
import { ScriptCoveragePanel } from "@/components/scenes/ScriptCoveragePanel";
import { SceneList } from "@/components/scenes/SceneList";
import {
  ProjectCastPanel,
  type ProjectCastEntry,
} from "@/components/scenes/ProjectCastPanel";

export function ScenePlanner({
  projectId,
  approvedVersion,
  latestRun,
  rows,
  estimatedCostCents,
  canEdit,
  initialSceneNumber,
  availableCharacters,
  cast,
  castAvailableCharacters,
  canGenerateImages,
  canReviewImages,
  videoKind,
  scriptCoverage,
}: {
  projectId: string;
  approvedVersion: ProjectScriptVersion | null;
  latestRun: SceneAnalysisRun | null;
  rows: Array<{
    scene: Scene;
    version: SceneVersion;
    assignedCharacters: Character[];
    characterStaging: SceneCharacterStaging[];
    imageIndicator: SceneImageIndicator;
  }>;
  videoKind: ProjectVideoKind;
  estimatedCostCents: number;
  canEdit: boolean;
  initialSceneNumber: number | null;
  availableCharacters: Character[];
  cast: ProjectCastEntry[];
  castAvailableCharacters: Character[];
  canGenerateImages: boolean;
  canReviewImages: boolean;
  scriptCoverage: ScriptCoverageView;
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
      <ScriptCoveragePanel view={scriptCoverage} />
      {rows.length > 0 ? (
        <ProjectCastPanel
          availableCharacters={castAvailableCharacters}
          canEdit={canEdit}
          cast={cast}
          projectId={projectId}
          totalScenes={rows.length}
        />
      ) : null}
      <SceneList
        canEdit={canEdit}
        initialSceneNumber={initialSceneNumber}
        rows={rows}
        availableCharacters={availableCharacters}
        canGenerateImages={canGenerateImages}
        canReviewImages={canReviewImages}
        videoKind={videoKind}
      />
    </div>
  );
}
