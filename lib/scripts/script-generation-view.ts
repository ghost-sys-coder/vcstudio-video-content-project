import "server-only";

import type { Project, ProjectBrief, ScriptGenerationRun } from "@/db/schema";
import { renderScriptGenerationPrompt } from "@studio/prompts";
import { estimateScriptGenerationCost } from "@/lib/costs/script-generation-cost";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { findLatestScriptGenerationRun } from "@/db/repositories/script-generation.repository";

export type ScriptGenerationRunView = {
  id: string;
  status: ScriptGenerationRun["status"];
  generatedContent: string | null;
  suggestedTitle: string | null;
  safeErrorMessage: string | null;
  estimatedCostCents: number;
  actualCostCents: number | null;
  createdAtLabel: string;
};

export type ScriptGenerationView = {
  model: string;
  hasBriefTopic: boolean;
  estimatedCostCents: number;
  latestRun: ScriptGenerationRunView | null;
};

function toRunView(run: ScriptGenerationRun): ScriptGenerationRunView {
  return {
    id: run.id,
    status: run.status,
    generatedContent: run.generatedContent,
    suggestedTitle: run.suggestedTitle,
    safeErrorMessage: run.safeErrorMessage,
    estimatedCostCents: run.estimatedCostCents,
    actualCostCents: run.actualCostCents,
    createdAtLabel: `${run.createdAt
      .toISOString()
      .slice(0, 16)
      .replace("T", " ")} UTC`,
  };
}

export async function loadScriptGenerationView(input: {
  workspaceId: string;
  project: Project;
  brief: ProjectBrief | null;
}): Promise<ScriptGenerationView> {
  const environment = getSceneAnalysisEnvironment();
  const hasBriefTopic = Boolean(input.brief && input.brief.topic.trim() !== "");
  let estimatedCostCents = 0;
  if (input.brief && hasBriefTopic) {
    const prompt = renderScriptGenerationPrompt({
      topic: input.brief.topic,
      targetAudience: input.brief.targetAudience,
      tone: input.brief.tone,
      targetDurationSeconds: input.brief.targetDurationSeconds,
      primaryPlatform: input.brief.primaryPlatform,
      hookAngle: input.brief.hookAngle,
      language: input.project.language,
    });
    estimatedCostCents = estimateScriptGenerationCost({
      prompt,
      targetDurationSeconds: input.brief.targetDurationSeconds,
      inputCostPerMillionCents:
        environment.OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS,
      outputCostPerMillionCents:
        environment.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS,
    }).estimatedCostCents;
  }
  const latestRun = await findLatestScriptGenerationRun({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
  });
  return {
    model: environment.OPENAI_TEXT_MODEL,
    hasBriefTopic,
    estimatedCostCents,
    latestRun: latestRun ? toRunView(latestRun) : null,
  };
}
