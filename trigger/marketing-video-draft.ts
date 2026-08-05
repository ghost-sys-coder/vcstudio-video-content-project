import { task, wait } from "@trigger.dev/sdk";
import { z } from "zod";
import { createProject } from "@/db/commands/create-project.command";
import { appendDeferredToolResultMessage } from "@/db/commands/marketing-chat-commands";
import {
  completeMarketingToolCall,
  failMarketingToolCall,
} from "@/db/commands/marketing-chat-tool-call-commands";
import { approveScriptVersion } from "@/db/commands/scene-commands";
import {
  createScriptVersion,
  saveScriptDraft,
} from "@/db/commands/script-commands";
import { findMarketingToolCall } from "@/db/repositories/marketing-chat.repository";
import { findScriptGenerationRun } from "@/db/repositories/script-generation.repository";
import { findSceneAnalysisRun } from "@/db/repositories/scenes.repository";
import { startSceneAnalysis } from "@/lib/scenes/start-scene-analysis";
import { startScriptGeneration } from "@/lib/scripts/start-script-generation";

const payloadSchema = z.object({
  workspaceId: z.uuid(),
  userId: z.string().min(1),
  toolCallId: z.uuid(),
});
const inputSchema = z.object({
  title: z.string(),
  topic: z.string(),
  audience: z.string(),
  tone: z.string(),
  platform: z.enum([
    "youtube",
    "tiktok",
    "instagram",
    "facebook",
    "linkedin",
    "twitter",
  ]),
  aspectRatio: z.enum(["portrait", "landscape", "square"]),
  durationSeconds: z.coerce.number().int(),
  hookAngle: z.string(),
});

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

export const marketingVideoDraftTask = task({
  id: "marketing-video-draft",
  queue: { name: "ai-text", concurrencyLimit: 2 },
  retry: { maxAttempts: 1 },
  maxDuration: 900,
  run: async (payload: z.infer<typeof payloadSchema>) => {
    const request = payloadSchema.parse(payload);
    const toolCall = await findMarketingToolCall({
      workspaceId: request.workspaceId,
      toolCallId: request.toolCallId,
    });
    if (!toolCall) throw new Error("Marketing tool call not found.");
    if (toolCall.status === "succeeded")
      return { projectId: String(toolCall.output?.projectId ?? "") };
    const values = inputSchema.parse(toolCall.input);
    try {
      const aspectRatio =
        values.aspectRatio === "portrait"
          ? "9:16"
          : values.aspectRatio === "landscape"
            ? "16:9"
            : "1:1";
      const project = await createProject({
        workspaceId: request.workspaceId,
        name: values.title,
        description: values.topic,
        aspectRatio,
        framesPerSecond: 30,
        language: "English",
        maximumBudgetCents: 500,
        userId: request.userId,
        brief: {
          topic: values.topic,
          targetAudience: values.audience,
          tone: values.tone,
          targetDurationSeconds: values.durationSeconds,
          primaryPlatform: values.platform,
          hookAngle: values.hookAngle,
          niche: "marketing",
        },
      });
      const generation = await startScriptGeneration({
        workspaceId: request.workspaceId,
        project,
        brief: {
          id: crypto.randomUUID(),
          workspaceId: request.workspaceId,
          projectId: project.id,
          topic: values.topic,
          targetAudience: values.audience,
          tone: values.tone,
          targetDurationSeconds: values.durationSeconds,
          primaryPlatform: values.platform,
          hookAngle: values.hookAngle,
          niche: "marketing",
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedByUserId: request.userId,
        },
        requestedByUserId: request.userId,
        requestNonce: toolCall.id,
      });
      const generated = await awaitScript({
        workspaceId: request.workspaceId,
        projectId: project.id,
        runId: generation.runId,
      });
      const draft = await saveScriptDraft({
        workspaceId: request.workspaceId,
        projectId: project.id,
        content: generated.generatedContent ?? "",
        revision: 0,
        userId: request.userId,
      });
      const version = await createScriptVersion({
        workspaceId: request.workspaceId,
        projectId: project.id,
        revision: draft.revision,
        userId: request.userId,
      });
      await approveScriptVersion({
        workspaceId: request.workspaceId,
        projectId: project.id,
        scriptVersionId: version.id,
        userId: request.userId,
      });
      const analysis = await startSceneAnalysis({
        workspaceId: request.workspaceId,
        project,
        version: {
          ...version,
          status: "approved",
          approvedByUserId: request.userId,
          approvedAt: new Date(),
        },
        requestedByUserId: request.userId,
      });
      if (analysis.analysisRunId)
        await awaitScenes({
          workspaceId: request.workspaceId,
          projectId: project.id,
          analysisRunId: analysis.analysisRunId,
        });
      const summary =
        "Your video draft is ready for storyboard review. Scene images have not been generated.";
      const completed = await completeMarketingToolCall({
        workspaceId: request.workspaceId,
        id: toolCall.id,
        output: { projectId: project.id },
        actualCostCents: 0,
      });
      if (completed)
        await appendDeferredToolResultMessage({
          workspaceId: request.workspaceId,
          threadId: toolCall.threadId,
          runId: null,
          part: {
            type: "data-toolResult",
            data: {
              skillKey: toolCall.skillKey,
              summary,
              projectId: project.id,
            },
          },
          plainText: summary,
          costCents: 0,
        });
      return { projectId: project.id };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The video draft could not be created.";
      await failMarketingToolCall({
        workspaceId: request.workspaceId,
        id: toolCall.id,
        category: "video_draft_failed",
        message,
        actualCostCents: 0,
      });
      await appendDeferredToolResultMessage({
        workspaceId: request.workspaceId,
        threadId: toolCall.threadId,
        runId: null,
        part: {
          type: "data-toolResult",
          data: { skillKey: toolCall.skillKey, summary: message, failed: true },
        },
        plainText: message,
        costCents: 0,
      });
      return { failed: true };
    }
  },
});
