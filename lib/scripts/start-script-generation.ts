import "server-only";

import { tasks } from "@trigger.dev/sdk";
import {
  renderScriptGenerationPrompt,
  SCRIPT_GENERATION_PROMPT_VERSION,
} from "@studio/prompts";
import type { Project, ProjectBrief } from "@/db/schema";
import {
  attachScriptGenerationTriggerRun,
  createScriptGenerationReservation,
  failScriptGeneration,
} from "@/db/commands/script-generation-commands";
import { findScriptGenerationRunByIdempotencyKey } from "@/db/repositories/script-generation.repository";
import {
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
} from "@/db/repositories/scenes.repository";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { estimateScriptGenerationCost } from "@/lib/costs/script-generation-cost";
import {
  createRequestFingerprint,
  createScriptGenerationIdempotencyKey,
} from "@/lib/domain/idempotency";
import { BudgetExceededError } from "@/lib/domain/errors";
import { isHistoricalContent } from "@/lib/domain/historical-content";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import type { scriptGenerationTask } from "@/trigger/script-generation";

export class ScriptGenerationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScriptGenerationRequestError";
  }
}

function briefFingerprintPayload(
  brief: ProjectBrief,
  language: string,
): string {
  return JSON.stringify({
    topic: brief.topic,
    targetAudience: brief.targetAudience,
    tone: brief.tone,
    targetDurationSeconds: brief.targetDurationSeconds,
    primaryPlatform: brief.primaryPlatform,
    hookAngle: brief.hookAngle,
    niche: brief.niche,
    language,
  });
}

export async function startScriptGeneration(input: {
  workspaceId: string;
  project: Project;
  brief: ProjectBrief | null;
  requestedByUserId: string;
  requestNonce: string;
}): Promise<{ runId: string; created: boolean }> {
  const environment = getSceneAnalysisEnvironment();
  await enforceRateLimit({
    workspaceId: input.workspaceId,
    operation: "script_generation",
  });

  const brief = input.brief;
  if (!brief || brief.topic.trim() === "")
    throw new ScriptGenerationRequestError(
      "Add a topic to the content brief before generating a script.",
    );

  const prompt = renderScriptGenerationPrompt({
    topic: brief.topic,
    targetAudience: brief.targetAudience,
    tone: brief.tone,
    targetDurationSeconds: brief.targetDurationSeconds,
    primaryPlatform: brief.primaryPlatform,
    hookAngle: brief.hookAngle,
    language: input.project.language,
    requireHistoricalAccuracy: isHistoricalContent({
      niche: brief.niche,
      topic: brief.topic,
      hookAngle: brief.hookAngle,
    }),
  });
  const estimate = estimateScriptGenerationCost({
    prompt,
    targetDurationSeconds: brief.targetDurationSeconds,
    inputCostPerMillionCents:
      environment.OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS,
    outputCostPerMillionCents:
      environment.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS,
  });

  const now = new Date();
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const startOfMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const [committed, dailyCommitted, monthlyCommitted, effectiveBudget] =
    await Promise.all([
      getProjectCommittedCostCents({
        workspaceId: input.workspaceId,
        projectId: input.project.id,
      }),
      getWorkspaceCommittedCostCents({
        workspaceId: input.workspaceId,
        since: startOfDay,
      }),
      getWorkspaceCommittedCostCents({
        workspaceId: input.workspaceId,
        since: startOfMonth,
      }),
      loadEffectiveWorkspaceBudget({ workspaceId: input.workspaceId }),
    ]);
  if (
    committed + estimate.estimatedCostCents >
    input.project.maximumBudgetCents
  )
    throw new BudgetExceededError("project");
  if (
    dailyCommitted + estimate.estimatedCostCents >
    effectiveBudget.dailyBudgetCents
  )
    throw new BudgetExceededError("workspace_daily");
  if (
    monthlyCommitted + estimate.estimatedCostCents >
    effectiveBudget.monthlyBudgetCents
  )
    throw new BudgetExceededError("workspace_monthly");

  const briefFingerprint = createRequestFingerprint(
    environment.REQUEST_FINGERPRINT_SECRET,
    briefFingerprintPayload(brief, input.project.language),
  );
  const idempotencyKey = createScriptGenerationIdempotencyKey({
    secret: environment.IDEMPOTENCY_HASH_SECRET,
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    briefFingerprint,
    model: environment.OPENAI_TEXT_MODEL,
    promptVersion: SCRIPT_GENERATION_PROMPT_VERSION,
    requestNonce: input.requestNonce,
  });
  const existing = await findScriptGenerationRunByIdempotencyKey({
    workspaceId: input.workspaceId,
    idempotencyKey,
  });
  if (existing) return { runId: existing.id, created: false };

  const runId = crypto.randomUUID();
  await createScriptGenerationReservation({
    id: runId,
    reservationId: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    userId: input.requestedByUserId,
    idempotencyKey,
    requestFingerprint: createRequestFingerprint(
      environment.REQUEST_FINGERPRINT_SECRET,
      prompt,
    ),
    model: environment.OPENAI_TEXT_MODEL,
    promptVersion: SCRIPT_GENERATION_PROMPT_VERSION,
    finalPrompt: prompt,
    estimatedCostCents: estimate.estimatedCostCents,
    expiresAt: new Date(
      Date.now() + environment.GENERATION_RESERVATION_EXPIRY_MINUTES * 60_000,
    ),
    budget: {
      workspaceDailyLimitCents: effectiveBudget.dailyBudgetCents,
      workspaceMonthlyLimitCents: effectiveBudget.monthlyBudgetCents,
      dailyWindowStart: startOfDay,
      monthlyWindowStart: startOfMonth,
    },
  });

  try {
    const handle = await tasks.trigger<typeof scriptGenerationTask>(
      "script-generation",
      {
        scriptGenerationRunId: runId,
        workspaceId: input.workspaceId,
        projectId: input.project.id,
      },
      { idempotencyKey },
    );
    await attachScriptGenerationTriggerRun({
      scriptGenerationRunId: runId,
      triggerRunId: handle.id,
    });
  } catch (error) {
    await failScriptGeneration({
      scriptGenerationRunId: runId,
      category: "trigger_error",
      message: "Script generation could not be queued.",
    });
    throw error;
  }

  return { runId, created: true };
}
