import "server-only";

import { tasks } from "@trigger.dev/sdk";
import type { Project } from "@/db/schema";
import {
  attachChapterGenerationTriggerRun,
  createChapterGenerationReservation,
  failChapterGeneration,
} from "@/db/commands/chapter-generation-commands";
import { findChapterGenerationRunByIdempotencyKey } from "@/db/repositories/chapter-generation.repository";
import {
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
} from "@/db/repositories/scenes.repository";
import { findVideoRender } from "@/db/repositories/video-render.repository";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { prepareChapterGeneration } from "@/lib/chapters/prepare-chapter-generation";
import {
  createChapterGenerationIdempotencyKey,
  createRequestFingerprint,
} from "@/lib/domain/idempotency";
import { BudgetExceededError } from "@/lib/domain/errors";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import type { chapterGenerationTask } from "@/trigger/chapter-generation";

export class ChapterGenerationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChapterGenerationRequestError";
  }
}

/**
 * Reserve budget for one chapter pass over one render, then queue it.
 *
 * The render is looked up by render id *and* the caller's workspace and
 * project, so a browser cannot point generation at someone else's video.
 */
export async function startChapterGeneration(input: {
  workspaceId: string;
  project: Project;
  renderId: string;
  requestedByUserId: string;
  requestNonce: string;
}): Promise<{ runId: string; created: boolean }> {
  const environment = getSceneAnalysisEnvironment();
  await enforceRateLimit({
    workspaceId: input.workspaceId,
    operation: "chapter_generation",
  });

  const render = await findVideoRender({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    renderId: input.renderId,
  });
  if (!render)
    throw new ChapterGenerationRequestError("That render no longer exists.");
  const plan = await prepareChapterGeneration({
    workspaceId: input.workspaceId,
    project: input.project,
    render,
  });
  if (!plan.eligible) throw new ChapterGenerationRequestError(plan.reason);

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
  if (committed + plan.estimatedCostCents > input.project.maximumBudgetCents)
    throw new BudgetExceededError("project");
  if (
    dailyCommitted + plan.estimatedCostCents >
    effectiveBudget.dailyBudgetCents
  )
    throw new BudgetExceededError("workspace_daily");
  if (
    monthlyCommitted + plan.estimatedCostCents >
    effectiveBudget.monthlyBudgetCents
  )
    throw new BudgetExceededError("workspace_monthly");

  const idempotencyKey = createChapterGenerationIdempotencyKey({
    secret: environment.IDEMPOTENCY_HASH_SECRET,
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    renderId: render.id,
    model: plan.model,
    promptVersion: plan.promptVersion,
    requestNonce: input.requestNonce,
  });
  const existing = await findChapterGenerationRunByIdempotencyKey({
    workspaceId: input.workspaceId,
    idempotencyKey,
  });
  if (existing) return { runId: existing.id, created: false };

  const runId = crypto.randomUUID();
  await createChapterGenerationReservation({
    id: runId,
    reservationId: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    renderId: render.id,
    userId: input.requestedByUserId,
    idempotencyKey,
    requestFingerprint: createRequestFingerprint(
      environment.REQUEST_FINGERPRINT_SECRET,
      plan.prompt,
    ),
    model: plan.model,
    promptVersion: plan.promptVersion,
    finalPrompt: plan.prompt,
    estimatedCostCents: plan.estimatedCostCents,
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
    const handle = await tasks.trigger<typeof chapterGenerationTask>(
      "chapter-generation",
      {
        chapterGenerationRunId: runId,
        workspaceId: input.workspaceId,
        projectId: input.project.id,
      },
      { idempotencyKey },
    );
    await attachChapterGenerationTriggerRun({
      chapterGenerationRunId: runId,
      triggerRunId: handle.id,
    });
  } catch (error) {
    await failChapterGeneration({
      chapterGenerationRunId: runId,
      category: "trigger_error",
      message: "Chapter generation could not be queued.",
    });
    throw error;
  }

  return { runId, created: true };
}
