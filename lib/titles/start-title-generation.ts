import "server-only";

import { tasks } from "@trigger.dev/sdk";
import {
  renderTitleGenerationPrompt,
  TITLE_GENERATION_PROMPT_VERSION,
} from "@studio/prompts";
import type { Project, ProjectBrief } from "@/db/schema";
import {
  attachTitleGenerationTriggerRun,
  createTitleGenerationReservation,
  failTitleGeneration,
} from "@/db/commands/title-generation-commands";
import { findTitleGenerationRunByIdempotencyKey } from "@/db/repositories/title-generation.repository";
import {
  findApprovedScriptVersion,
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
} from "@/db/repositories/scenes.repository";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { estimateTitleGenerationCost } from "@/lib/costs/title-generation-cost";
import {
  createRequestFingerprint,
  createTitleGenerationIdempotencyKey,
} from "@/lib/domain/idempotency";
import { BudgetExceededError } from "@/lib/domain/errors";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import {
  contentPlatformSchema,
  DEFAULT_TITLE_OPTIONS,
  MAX_TITLE_OPTIONS,
  MIN_TITLE_OPTIONS,
  type ContentPlatformValue,
} from "@/lib/schemas/title-generation";
import type { titleGenerationTask } from "@/trigger/title-generation";

export class TitleGenerationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TitleGenerationRequestError";
  }
}

function clampOptionCount(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TITLE_OPTIONS;
  return Math.min(
    MAX_TITLE_OPTIONS,
    Math.max(MIN_TITLE_OPTIONS, Math.round(value)),
  );
}

export async function startTitleGeneration(input: {
  workspaceId: string;
  project: Project;
  brief: ProjectBrief | null;
  platform: ContentPlatformValue;
  optionCount: number;
  requestedByUserId: string;
  requestNonce: string;
}): Promise<{ runId: string; created: boolean }> {
  const platform = contentPlatformSchema.parse(input.platform);
  const optionCount = clampOptionCount(input.optionCount);
  const environment = getSceneAnalysisEnvironment();
  await enforceRateLimit({
    workspaceId: input.workspaceId,
    operation: "title_generation",
  });

  const brief = input.brief;
  const approvedScript = await findApprovedScriptVersion({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
  });
  const hasTopic = Boolean(brief && brief.topic.trim() !== "");
  if (!hasTopic && !approvedScript)
    throw new TitleGenerationRequestError(
      "Add a topic to the brief or approve a script before generating titles.",
    );

  const prompt = renderTitleGenerationPrompt({
    platform,
    topic: brief?.topic ?? "",
    targetAudience: brief?.targetAudience ?? "",
    tone: brief?.tone ?? "",
    hookAngle: brief?.hookAngle ?? "",
    script: approvedScript?.content ?? null,
    language: input.project.language,
    optionCount,
  });
  const estimate = estimateTitleGenerationCost({
    prompt,
    optionCount,
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
    JSON.stringify({
      platform,
      optionCount,
      topic: brief?.topic ?? "",
      targetAudience: brief?.targetAudience ?? "",
      tone: brief?.tone ?? "",
      hookAngle: brief?.hookAngle ?? "",
      scriptVersionId: approvedScript?.id ?? null,
      language: input.project.language,
    }),
  );
  const idempotencyKey = createTitleGenerationIdempotencyKey({
    secret: environment.IDEMPOTENCY_HASH_SECRET,
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    platform,
    briefFingerprint,
    model: environment.OPENAI_TEXT_MODEL,
    promptVersion: TITLE_GENERATION_PROMPT_VERSION,
    requestNonce: input.requestNonce,
  });
  const existing = await findTitleGenerationRunByIdempotencyKey({
    workspaceId: input.workspaceId,
    idempotencyKey,
  });
  if (existing) return { runId: existing.id, created: false };

  const runId = crypto.randomUUID();
  await createTitleGenerationReservation({
    id: runId,
    reservationId: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    userId: input.requestedByUserId,
    platform,
    scriptVersionId: approvedScript?.id ?? null,
    idempotencyKey,
    requestFingerprint: createRequestFingerprint(
      environment.REQUEST_FINGERPRINT_SECRET,
      prompt,
    ),
    model: environment.OPENAI_TEXT_MODEL,
    promptVersion: TITLE_GENERATION_PROMPT_VERSION,
    finalPrompt: prompt,
    requestedOptionCount: optionCount,
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
    const handle = await tasks.trigger<typeof titleGenerationTask>(
      "title-generation",
      {
        titleGenerationRunId: runId,
        workspaceId: input.workspaceId,
        projectId: input.project.id,
      },
      { idempotencyKey },
    );
    await attachTitleGenerationTriggerRun({
      titleGenerationRunId: runId,
      triggerRunId: handle.id,
    });
  } catch (error) {
    await failTitleGeneration({
      titleGenerationRunId: runId,
      category: "trigger_error",
      message: "Title generation could not be queued.",
    });
    throw error;
  }

  return { runId, created: true };
}
