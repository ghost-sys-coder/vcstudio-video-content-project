import "server-only";
import { wait } from "@trigger.dev/sdk";
import { createProject } from "@/db/commands/create-project.command";
import { approveScriptVersion } from "@/db/commands/scene-commands";
import {
  createScriptVersion,
  saveScriptDraft,
} from "@/db/commands/script-commands";
import { findSceneAnalysisRun } from "@/db/repositories/scenes.repository";
import { findScriptGenerationRun } from "@/db/repositories/script-generation.repository";
import type { ContentPlatform } from "@/db/schema";
import { startSceneAnalysis } from "@/lib/scenes/start-scene-analysis";
import { startScriptGeneration } from "@/lib/scripts/start-script-generation";

async function awaitScript(input: {
  workspaceId: string;
  projectId: string;
  runId: string;
}) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const run = await findScriptGenerationRun({
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      scriptGenerationRunId: input.runId,
    });
    if (run?.status === "completed" && run.generatedContent) return run;
    if (run?.status === "failed")
      throw new Error(run.safeErrorMessage ?? "Script generation failed.");
    await wait.for({ seconds: 5 });
  }
  throw new Error("Script generation timed out.");
}

async function awaitScenes(input: {
  workspaceId: string;
  projectId: string;
  analysisRunId: string;
}) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const run = await findSceneAnalysisRun(input);
    if (run?.status === "completed") return;
    if (run?.status === "failed")
      throw new Error(run.safeErrorMessage ?? "Scene analysis failed.");
    await wait.for({ seconds: 5 });
  }
  throw new Error("Scene analysis timed out.");
}

export async function createVideoDraftProject(input: {
  workspaceId: string;
  userId: string;
  requestNonce: string;
  title: string;
  topic: string;
  audience: string;
  tone: string;
  platform: ContentPlatform;
  aspectRatio: "9:16" | "16:9" | "1:1";
  durationSeconds: number;
  hookAngle: string;
}) {
  const project = await createProject({
    workspaceId: input.workspaceId,
    name: input.title,
    description: input.topic,
    aspectRatio: input.aspectRatio,
    framesPerSecond: 30,
    language: "English",
    maximumBudgetCents: 500,
    userId: input.userId,
    brief: {
      topic: input.topic,
      targetAudience: input.audience,
      tone: input.tone,
      targetDurationSeconds: input.durationSeconds,
      primaryPlatform: input.platform,
      hookAngle: input.hookAngle,
      niche: "marketing",
    },
  });
  const brief = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: project.id,
    topic: input.topic,
    targetAudience: input.audience,
    tone: input.tone,
    targetDurationSeconds: input.durationSeconds,
    primaryPlatform: input.platform,
    hookAngle: input.hookAngle,
    niche: "marketing",
    createdAt: new Date(),
    updatedAt: new Date(),
    updatedByUserId: input.userId,
  };
  const generation = await startScriptGeneration({
    workspaceId: input.workspaceId,
    project,
    brief,
    requestedByUserId: input.userId,
    requestNonce: input.requestNonce,
  });
  const generated = await awaitScript({
    workspaceId: input.workspaceId,
    projectId: project.id,
    runId: generation.runId,
  });
  const draft = await saveScriptDraft({
    workspaceId: input.workspaceId,
    projectId: project.id,
    content: generated.generatedContent ?? "",
    revision: 0,
    userId: input.userId,
  });
  const version = await createScriptVersion({
    workspaceId: input.workspaceId,
    projectId: project.id,
    revision: draft.revision,
    userId: input.userId,
  });
  await approveScriptVersion({
    workspaceId: input.workspaceId,
    projectId: project.id,
    scriptVersionId: version.id,
    userId: input.userId,
  });
  const analysis = await startSceneAnalysis({
    workspaceId: input.workspaceId,
    project,
    version: {
      ...version,
      status: "approved",
      approvedByUserId: input.userId,
      approvedAt: new Date(),
    },
    requestedByUserId: input.userId,
  });
  if (analysis.analysisRunId)
    await awaitScenes({
      workspaceId: input.workspaceId,
      projectId: project.id,
      analysisRunId: analysis.analysisRunId,
    });
  return project;
}
