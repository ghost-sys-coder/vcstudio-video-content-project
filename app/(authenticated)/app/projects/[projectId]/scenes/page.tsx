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
  listSceneVersionCharacters,
} from "@/db/repositories/characters.repository";

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
  const [availableCharacters, assignments] = await Promise.all([
    listCharacters({ workspaceId: scope.workspaceId, status: "active" }),
    listSceneVersionCharacters({
      ...scope,
      sceneVersionIds: rows.map((row) => row.version.id),
    }),
  ]);
  const rowsWithCharacters = rows.map((row) => ({
    ...row,
    assignedCharacters: assignments
      .filter((item) => item.assignment.sceneVersionId === row.version.id)
      .map((item) => item.character),
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
      projectAspectRatio={project.aspectRatio}
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
