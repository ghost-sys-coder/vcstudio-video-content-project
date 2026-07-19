"use server";

import { revalidatePath } from "next/cache";
import { tasks } from "@trigger.dev/sdk";
import { assignSceneCharacters } from "@/db/commands/character-commands";
import { assignSceneCharactersSchema } from "@/lib/schemas/character";
import type { sceneAnalysisTask } from "@/trigger/scene-analysis";
import { findProject } from "@/db/repositories/projects.repository";
import {
  findApprovedScriptVersion,
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
} from "@/db/repositories/scenes.repository";
import {
  approveAllScenes,
  approveScene,
  approveScriptVersion,
  attachTriggerRun,
  createSceneAnalysisReservation,
  failSceneAnalysis,
  updateScene,
} from "@/db/commands/scene-commands";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  approveAllScenesSchema,
  approveSceneSchema,
  approveScriptVersionSchema,
  reconcileSceneAnalysisSchema,
  startSceneAnalysisSchema,
  updateSceneSchema,
} from "@/lib/schemas/scene";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import {
  renderSceneAnalysisPrompt,
  SCENE_ANALYSIS_PROMPT_VERSION,
} from "@studio/prompts";
import { estimateSceneAnalysisCost } from "@/lib/costs/scene-analysis-cost";
import {
  createRequestFingerprint,
  createSceneAnalysisIdempotencyKey,
} from "@/lib/domain/idempotency";
import { resolveSceneAnalysisIdempotency } from "@/lib/workflows/scene-analysis-idempotency";
import { reconcileSceneAnalysisRun } from "@/lib/trigger/reconcile-scene-analysis";
import {
  BudgetExceededError,
  RateLimitExceededError,
} from "@/lib/domain/errors";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";

export type SceneActionState = { success: boolean; error: string | null };

async function requireProjectMutation(
  projectId: string,
  capability:
    "approveScripts" | "analyzeScenes" | "editScenes" | "approveScenes",
) {
  const { context, project } = await requireProjectAccess(projectId);
  requireCapability(context.activeMembership.role, capability);
  if (project.status === "archived") throw new Error("Project not found.");
  return { context, project };
}

export async function assignSceneCharactersAction(
  formData: FormData,
): Promise<SceneActionState> {
  const parsed = assignSceneCharactersSchema.safeParse({
    ...Object.fromEntries(formData),
    characterIds: formData.getAll("characterIds"),
  });
  if (!parsed.success)
    return { success: false, error: "Invalid character assignment." };
  try {
    const { context } = await requireProjectMutation(
      parsed.data.projectId,
      "editScenes",
    );
    await assignSceneCharacters({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/scenes`);
    return { success: true, error: null };
  } catch {
    return {
      success: false,
      error: "The scene characters could not be assigned.",
    };
  }
}

async function requireProjectAccess(projectId: string) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) throw new Error("Workspace context missing.");
  const project = await findProject({
    workspaceId: context.activeMembership.workspaceId,
    projectId,
  });
  if (!project) throw new Error("Project not found.");
  return { context, project };
}

export async function approveScriptVersionAction(
  formData: FormData,
): Promise<SceneActionState> {
  const parsed = approveScriptVersionSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { success: false, error: "Invalid script version." };
  try {
    const { context } = await requireProjectMutation(
      parsed.data.projectId,
      "approveScripts",
    );
    await approveScriptVersion({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}`, "layout");
    return { success: true, error: null };
  } catch {
    return {
      success: false,
      error: "The script version could not be approved.",
    };
  }
}

export async function startSceneAnalysisAction(
  formData: FormData,
): Promise<SceneActionState> {
  const parsed = startSceneAnalysisSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { success: false, error: "Invalid analysis request." };
  try {
    const { context, project } = await requireProjectMutation(
      parsed.data.projectId,
      "analyzeScenes",
    );
    const workspaceId = context.activeMembership.workspaceId;
    await enforceRateLimit({ workspaceId, operation: "scene_analysis" });
    const environment = getSceneAnalysisEnvironment();
    const version = await findApprovedScriptVersion({
      workspaceId,
      ...parsed.data,
    });
    if (!version)
      return {
        success: false,
        error: "Approve this script version before analysis.",
      };
    const prompt = renderSceneAnalysisPrompt({
      script: version.content,
      maximumScenes: environment.MAX_SCENES_PER_PROJECT,
      aspectRatio: project.aspectRatio,
      language: project.language,
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
    const [committed, dailyCommitted, monthlyCommitted, effectiveBudget] =
      await Promise.all([
        getProjectCommittedCostCents({ workspaceId, projectId: project.id }),
        getWorkspaceCommittedCostCents({ workspaceId, since: startOfDay }),
        getWorkspaceCommittedCostCents({ workspaceId, since: startOfMonth }),
        loadEffectiveWorkspaceBudget({ workspaceId }),
      ]);
    if (committed + estimate.estimatedCostCents > project.maximumBudgetCents)
      return {
        success: false,
        error: "This analysis would exceed the project budget.",
      };
    if (
      dailyCommitted + estimate.estimatedCostCents >
      effectiveBudget.dailyBudgetCents
    )
      return {
        success: false,
        error: "This analysis would exceed the workspace daily budget.",
      };
    if (
      monthlyCommitted + estimate.estimatedCostCents >
      effectiveBudget.monthlyBudgetCents
    )
      return {
        success: false,
        error: "This analysis would exceed the workspace monthly budget.",
      };
    const initialIdempotencyKey = createSceneAnalysisIdempotencyKey({
      secret: environment.IDEMPOTENCY_HASH_SECRET,
      workspaceId,
      projectId: project.id,
      scriptVersionId: version.id,
      model: environment.OPENAI_TEXT_MODEL,
      promptVersion: SCENE_ANALYSIS_PROMPT_VERSION,
    });
    const idempotency = await resolveSceneAnalysisIdempotency({
      workspaceId,
      projectId: project.id,
      initialIdempotencyKey,
      secret: environment.IDEMPOTENCY_HASH_SECRET,
    });
    if (idempotency.action === "reuse") return { success: true, error: null };
    const idempotencyKey = idempotency.idempotencyKey;
    const analysisRunId = crypto.randomUUID();
    await createSceneAnalysisReservation({
      id: analysisRunId,
      reservationId: crypto.randomUUID(),
      workspaceId,
      projectId: project.id,
      scriptVersionId: version.id,
      userId: context.user.id,
      idempotencyKey,
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
        workspaceDailyLimitCents: effectiveBudget.dailyBudgetCents,
        workspaceMonthlyLimitCents: effectiveBudget.monthlyBudgetCents,
        dailyWindowStart: startOfDay,
        monthlyWindowStart: startOfMonth,
      },
    });
    try {
      const handle = await tasks.trigger<typeof sceneAnalysisTask>(
        "scene-analysis",
        {
          analysisRunId,
          workspaceId,
          projectId: project.id,
          scriptVersionId: version.id,
          userId: context.user.id,
        },
        { idempotencyKey },
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
    revalidatePath(`/app/projects/${project.id}/scenes`);
    return { success: true, error: null };
  } catch (error) {
    if (error instanceof RateLimitExceededError)
      return { success: false, error: error.message };
    if (error instanceof BudgetExceededError) {
      const budgetLabel =
        error.scope === "project"
          ? "project"
          : error.scope === "workspace_daily"
            ? "workspace daily"
            : "workspace monthly";
      return {
        success: false,
        error: `This analysis would exceed the ${budgetLabel} budget.`,
      };
    }
    return { success: false, error: "Scene analysis could not be started." };
  }
}

export async function reconcileSceneAnalysisRunAction(
  formData: FormData,
): Promise<SceneActionState> {
  const parsed = reconcileSceneAnalysisSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { success: false, error: "Invalid analysis run." };
  try {
    const { context } = await requireProjectAccess(parsed.data.projectId);
    await reconcileSceneAnalysisRun({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/scenes`);
    return { success: true, error: null };
  } catch {
    return {
      success: false,
      error: "The analysis status could not be refreshed.",
    };
  }
}

export async function updateSceneAction(
  formData: FormData,
): Promise<SceneActionState> {
  const raw = Object.fromEntries(formData);
  const parsed = updateSceneSchema.safeParse({
    ...raw,
    characterNames: String(raw.characterNames ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    propNames: String(raw.propNames ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    estimatedDurationMilliseconds: Number(raw.estimatedDurationMilliseconds),
  });
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid scene.",
    };
  try {
    const { context } = await requireProjectMutation(
      parsed.data.projectId,
      "editScenes",
    );
    await updateScene({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
      userId: context.user.id,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/scenes`);
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error && error.message === "SCENE_REVISION_CONFLICT"
          ? "This scene changed in another session. Refresh and try again."
          : "The scene could not be saved.",
    };
  }
}

export async function approveSceneAction(
  formData: FormData,
): Promise<SceneActionState> {
  const parsed = approveSceneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: "Invalid scene." };
  try {
    const { context } = await requireProjectMutation(
      parsed.data.projectId,
      "approveScenes",
    );
    await approveScene({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
    });
    await recordAuditEvent({
      workspaceId: context.activeMembership.workspaceId,
      actorUserId: context.user.id,
      projectId: parsed.data.projectId,
      action: "scene_approved",
      targetType: "scene",
      targetId: parsed.data.sceneId,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/scenes`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The scene could not be approved." };
  }
}

export async function approveAllScenesAction(
  formData: FormData,
): Promise<SceneActionState> {
  const parsed = approveAllScenesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { success: false, error: "Invalid project." };
  try {
    const { context } = await requireProjectMutation(
      parsed.data.projectId,
      "approveScenes",
    );
    await approveAllScenes({
      ...parsed.data,
      workspaceId: context.activeMembership.workspaceId,
    });
    revalidatePath(`/app/projects/${parsed.data.projectId}/scenes`);
    return { success: true, error: null };
  } catch {
    return { success: false, error: "The scenes could not be approved." };
  }
}
