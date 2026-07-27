import { notFound } from "next/navigation";
import { ScenePlanner } from "@/components/scenes/ScenePlanner";
import { findProject } from "@/db/repositories/projects.repository";
import {
  findApprovedScriptVersion,
  findLatestSceneAnalysisRun,
  listCurrentScenes,
} from "@/db/repositories/scenes.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { can, canEditProject } from "@/lib/policies/workspace-policy";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { renderSceneAnalysisPrompt } from "@studio/prompts";
import { estimateSceneAnalysisCost } from "@/lib/costs/scene-analysis-cost";
import {
  listCharacters,
  listCharactersByIds,
  listSceneVersionCharacters,
} from "@/db/repositories/characters.repository";
import {
  listAnimationReadyCharacters,
  listSceneAnimationDirectionsForVersions,
} from "@/db/repositories/scene-animation.repository";
import { listProjectCast } from "@/db/repositories/project-characters.repository";
import { listSceneImageGenerationsForSceneVersions } from "@/db/repositories/scene-images.repository";
import { buildSceneImageIndicatorMap } from "@/lib/scenes/scene-image-indicator";
import { matchCharacterNamesToCast } from "@/lib/scenes/character-name-matching";
import type { ProjectCastEntry } from "@/components/scenes/ProjectCastPanel";

export default async function ProjectScenesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ scene?: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const { projectId } = await params;
  const { scene: sceneParam } = await searchParams;
  const parsedSceneNumber = Number(sceneParam);
  const initialSceneNumber =
    Number.isInteger(parsedSceneNumber) && parsedSceneNumber > 0
      ? parsedSceneNumber
      : null;
  const scope = {
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  };
  const [project, approvedVersion, latestRun, rows] = await Promise.all([
    findProject(scope),
    findApprovedScriptVersion(scope),
    findLatestSceneAnalysisRun(scope),
    listCurrentScenes(scope),
  ]);
  if (!project) notFound();
  const sceneVersionIds = rows.map((row) => row.version.id);
  const [
    availableCharacters,
    assignments,
    imageGenerations,
    cast,
    animationReadyCharacters,
    animationDirections,
  ] = await Promise.all([
    listCharacters({ workspaceId: scope.workspaceId, status: "active" }),
    listSceneVersionCharacters({ ...scope, sceneVersionIds }),
    listSceneImageGenerationsForSceneVersions({ ...scope, sceneVersionIds }),
    listProjectCast(scope),
    listAnimationReadyCharacters({ workspaceId: scope.workspaceId }),
    listSceneAnimationDirectionsForVersions({ ...scope, sceneVersionIds }),
  ]);
  const animatedCharacterIds = [
    ...new Set(animationDirections.map((direction) => direction.characterId)),
  ];
  const animatedCharacters = await listCharactersByIds({
    workspaceId: scope.workspaceId,
    characterIds: animatedCharacterIds,
  });
  const animatedCharacterById = new Map(
    animatedCharacters.map((character) => [character.id, character]),
  );
  const animatedCharacterBySceneVersionId = new Map(
    animationDirections.map((direction) => [
      direction.sceneVersionId,
      animatedCharacterById.get(direction.characterId) ?? null,
    ]),
  );
  const castCandidates = cast.map((member) => ({
    id: member.characterId,
    name: member.character.name,
  }));
  const matchedSceneCountByCharacter = new Map<string, number>();
  for (const row of rows) {
    for (const characterId of matchCharacterNamesToCast(
      row.version.characterNames ?? [],
      castCandidates,
    )) {
      matchedSceneCountByCharacter.set(
        characterId,
        (matchedSceneCountByCharacter.get(characterId) ?? 0) + 1,
      );
    }
  }
  const castEntries: ProjectCastEntry[] = cast.map((member) => ({
    characterId: member.characterId,
    name: member.character.name,
    status: member.character.status,
    matchedSceneCount:
      matchedSceneCountByCharacter.get(member.characterId) ?? 0,
  }));
  const castCharacterIds = new Set(cast.map((member) => member.characterId));
  const castAvailableCharacters = availableCharacters.filter(
    (character) => !castCharacterIds.has(character.id),
  );
  const imageIndicatorBySceneId = buildSceneImageIndicatorMap(imageGenerations);
  const rowsWithCharacters = rows.map((row) => ({
    ...row,
    assignedCharacters: assignments
      .filter((item) => item.assignment.sceneVersionId === row.version.id)
      .map((item) => item.character),
    imageIndicator: imageIndicatorBySceneId.get(row.scene.id) ?? {
      state: "none" as const,
    },
    animatedCharacter:
      animatedCharacterBySceneVersionId.get(row.version.id) ?? null,
  }));
  const environment = getSceneAnalysisEnvironment();
  const prompt = approvedVersion
    ? renderSceneAnalysisPrompt({
        script: approvedVersion.content,
        maximumScenes: environment.MAX_SCENES_PER_PROJECT,
        aspectRatio: project.aspectRatio,
        language: project.language,
      })
    : "";
  const estimate = prompt
    ? estimateSceneAnalysisCost({
        prompt,
        inputCostPerMillionCents:
          environment.OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS,
        outputCostPerMillionCents:
          environment.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS,
      }).estimatedCostCents
    : 0;
  return (
    <ScenePlanner
      approvedVersion={approvedVersion}
      canEdit={
        canEditProject(context.activeMembership.role) &&
        project.status !== "archived"
      }
      estimatedCostCents={estimate}
      latestRun={latestRun}
      initialSceneNumber={initialSceneNumber}
      projectId={project.id}
      rows={rowsWithCharacters}
      availableCharacters={availableCharacters}
      animationReadyCharacters={animationReadyCharacters}
      cast={castEntries}
      castAvailableCharacters={castAvailableCharacters}
      canGenerateImages={
        can(context.activeMembership.role, "generateSceneImages") &&
        project.status !== "archived"
      }
      canReviewImages={
        can(context.activeMembership.role, "reviewSceneImages") &&
        project.status !== "archived"
      }
    />
  );
}
