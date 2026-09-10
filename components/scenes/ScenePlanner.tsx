import type {
  ProjectScriptVersion,
  Scene,
  SceneAnalysisRun,
  SceneVersion,
  Character,
  ProjectVideoKind,
} from "@/db/schema";
import type { SceneWorkspaceState } from "@/lib/production/scene-workspace-state";
import type { SceneImageIndicator } from "@/lib/scenes/scene-image-indicator";
import type { SceneCharacterStaging } from "@/lib/scenes/scene-character-staging";
import type { ScriptCoverageView } from "@/lib/scenes/script-coverage-view";
import { ScenePlannerHeader } from "@/components/scenes/ScenePlannerHeader";
import { SceneWorkspace } from "@/components/scenes/SceneWorkspace";
import { AnalysisProgressPanel } from "@/components/scenes/AnalysisProgressPanel";
import { SceneAnalysisErrorState } from "@/components/scenes/SceneAnalysisErrorState";
import { ScriptCoveragePanel } from "@/components/scenes/ScriptCoveragePanel";
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
  workspaceState,
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
  workspaceState: SceneWorkspaceState;
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
    <SceneWorkspace
      availableCharacters={availableCharacters}
      canEdit={canEdit}
      canGenerateImages={canGenerateImages}
      canReviewImages={canReviewImages}
      initialState={workspaceState}
      projectId={projectId}
      rows={rows}
      videoKind={videoKind}
    >
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
    </SceneWorkspace>
  );
}
