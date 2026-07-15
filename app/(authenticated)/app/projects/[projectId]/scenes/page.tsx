import { notFound } from "next/navigation";
import { ScenePlanner } from "@/components/scenes/ScenePlanner";
import { findProject } from "@/db/repositories/projects.repository";
import {
  findApprovedScriptVersion,
  findLatestSceneAnalysisRun,
  listCurrentScenes,
} from "@/db/repositories/scenes.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { canEditProject } from "@/lib/policies/workspace-policy";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { renderSceneAnalysisPrompt } from "@studio/prompts";
import { estimateSceneAnalysisCost } from "@/lib/costs/scene-analysis-cost";

export default async function ProjectScenesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const { projectId } = await params;
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
      projectId={project.id}
      rows={rows}
    />
  );
}
