import "server-only";
import { tasks } from "@trigger.dev/sdk";
import {
  renderSceneAnalysisPrompt,
  SCENE_ANALYSIS_PROMPT_VERSION,
} from "@studio/prompts";
import type { Project, ProjectScriptVersion } from "@/db/schema";
import {
  attachTriggerRun,
  createSceneAnalysisReservation,
  failSceneAnalysis,
} from "@/db/commands/scene-commands";
import {
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
} from "@/db/repositories/scenes.repository";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { estimateSceneAnalysisCost } from "@/lib/costs/scene-analysis-cost";
import { BudgetExceededError } from "@/lib/domain/errors";
import {
  createRequestFingerprint,
  createSceneAnalysisIdempotencyKey,
} from "@/lib/domain/idempotency";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import { resolveSceneAnalysisIdempotency } from "@/lib/workflows/scene-analysis-idempotency";
import type { sceneAnalysisTask } from "@/trigger/scene-analysis";

export async function startSceneAnalysis(input: {
  workspaceId: string;
  project: Project;
  version: ProjectScriptVersion;
  requestedByUserId: string;
}) {
  await enforceRateLimit({
    workspaceId: input.workspaceId,
    operation: "scene_analysis",
  });
  const environment = getSceneAnalysisEnvironment();
  const prompt = renderSceneAnalysisPrompt({
    script: input.version.content,
    maximumScenes: environment.MAX_SCENES_PER_PROJECT,
    aspectRatio: input.project.aspectRatio,
    language: input.project.language,
  });
  const estimate = estimateSceneAnalysisCost({
    prompt,
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
  const [projectCost, dailyCost, monthlyCost, budget] = await Promise.all([
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
    projectCost + estimate.estimatedCostCents >
    input.project.maximumBudgetCents
  )
    throw new BudgetExceededError("project");
  if (dailyCost + estimate.estimatedCostCents > budget.dailyBudgetCents)
    throw new BudgetExceededError("workspace_daily");
  if (monthlyCost + estimate.estimatedCostCents > budget.monthlyBudgetCents)
    throw new BudgetExceededError("workspace_monthly");
  const initialIdempotencyKey = createSceneAnalysisIdempotencyKey({
    secret: environment.IDEMPOTENCY_HASH_SECRET,
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    scriptVersionId: input.version.id,
    model: environment.OPENAI_TEXT_MODEL,
    promptVersion: SCENE_ANALYSIS_PROMPT_VERSION,
  });
  const resolved = await resolveSceneAnalysisIdempotency({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    initialIdempotencyKey,
    secret: environment.IDEMPOTENCY_HASH_SECRET,
  });
  if (resolved.action === "reuse")
    return { analysisRunId: null, created: false };
  const analysisRunId = crypto.randomUUID();
  await createSceneAnalysisReservation({
    id: analysisRunId,
    reservationId: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    scriptVersionId: input.version.id,
    userId: input.requestedByUserId,
    idempotencyKey: resolved.idempotencyKey,
    requestFingerprint: createRequestFingerprint(
      environment.REQUEST_FINGERPRINT_SECRET,
      prompt,
    ),
    model: environment.OPENAI_TEXT_MODEL,
    promptVersion: SCENE_ANALYSIS_PROMPT_VERSION,
    finalPrompt: prompt,
    estimatedCostCents: estimate.estimatedCostCents,
    expiresAt: new Date(
      Date.now() + environment.GENERATION_RESERVATION_EXPIRY_MINUTES * 60_000,
    ),
    budget: {
      workspaceDailyLimitCents: budget.dailyBudgetCents,
      workspaceMonthlyLimitCents: budget.monthlyBudgetCents,
      dailyWindowStart: startOfDay,
      monthlyWindowStart: startOfMonth,
    },
  });
  try {
    const handle = await tasks.trigger<typeof sceneAnalysisTask>(
      "scene-analysis",
      {
        analysisRunId,
        workspaceId: input.workspaceId,
        projectId: input.project.id,
        scriptVersionId: input.version.id,
        userId: input.requestedByUserId,
      },
      { idempotencyKey: resolved.idempotencyKey },
    );
    await attachTriggerRun({ analysisRunId, triggerRunId: handle.id });
  } catch (error) {
    await failSceneAnalysis({
      analysisRunId,
      category: "trigger_error",
      message: "Scene analysis could not be queued.",
    });
    throw error;
  }
  return { analysisRunId, created: true };
}
