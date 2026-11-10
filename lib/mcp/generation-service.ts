import "server-only";
import { randomBytes } from "node:crypto";
import { tasks } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  generationPreviewSchema,
  mcpGenerationRequestSchema,
  type GenerationPreview,
  type McpGenerationRequest,
} from "@studio/contracts/mcp-generation";
import {
  beginMcpOperation,
  findMcpOperation,
  findMcpOperationByKey,
  updateMcpOperation,
  type McpOperation,
} from "@/db/repositories/mcp.repository";
import {
  consumeMcpGeneration,
  listMcpGenerationJobs,
} from "@/db/repositories/mcp-generation.repository";
import { reserveMcpGeneration } from "@/db/commands/mcp-generation-commands";
import { findCurrentScene } from "@/db/repositories/scenes.repository";
import {
  startSceneImageGeneration,
  SceneImageGenerationRequestError,
} from "@/lib/scenes/start-scene-image-generation";
import {
  startSceneAudioGeneration,
  SceneAudioGenerationRequestError,
} from "@/lib/audio/start-scene-audio-generation";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import type {
  SceneImageGenerationPlan,
  SceneAudioGenerationPlan,
} from "./scene-generation-plan";
import { buildStandaloneGenerationPlan } from "./standalone-generation-plan";
import { authorizeMcpBrowser, type McpContext } from "./context";
import { requireMcpProject } from "./project-access";
import { fingerprint } from "./fingerprint";
import { requireMcp, McpError } from "./errors";
import { settleMcpGeneration } from "@/db/commands/mcp-generation-commands";
import { getSpeechProviderEnvironment } from "@/lib/env/server";
import { NarrationInputError } from "@/lib/audio/narration-input";
import { can } from "@/lib/policies/workspace-policy";
import { publicOperation } from "./operations";
import { effectiveGenerationApprovalMode } from "./generation-approval-policy";
import { reconcileMcpGenerationWorker } from "./reconcile-generation-worker";

export function generationAuthority(ctx: McpContext) {
  return fingerprint({
    userId: ctx.principal.userId,
    connectionId: ctx.connection.id,
    connectionRevision: ctx.connection.updatedAt.toISOString(),
    grantRevision: ctx.grant.updatedAt.toISOString(),
    scopes: [...ctx.grant.scopes].sort(),
    role: ctx.membership.role,
    generationApprovalMode: ctx.grant.generationApprovalMode,
  });
}
async function buildGenerationPlan(
  ctx: McpContext,
  request: McpGenerationRequest,
  operationId: string,
) {
  try {
    return await loadGenerationPlan(ctx, request, operationId);
  } catch (error) {
    if (
      error instanceof SceneImageGenerationRequestError ||
      error instanceof SceneAudioGenerationRequestError ||
      error instanceof NarrationInputError
    )
      throw new McpError("invalid_generation", error.message);
    throw error;
  }
}
async function loadGenerationPlan(
  ctx: McpContext,
  request: McpGenerationRequest,
  operationId: string,
) {
  if (request.kind === "image" || request.kind === "audio") {
    requireMcp(
      can(ctx.membership.role, "manageMediaLibrary") &&
        can(
          ctx.membership.role,
          request.kind === "image"
            ? "generateSceneImages"
            : "generateSceneAudio",
        ),
      "permission_denied",
      "Your workspace role cannot generate this library media.",
    );
    return buildStandaloneGenerationPlan(ctx.workspaceId, request);
  }
  const project = await requireMcpProject(
    ctx,
    request.projectId,
    request.kind === "scene_image"
      ? "generateSceneImages"
      : "generateSceneAudio",
  );
  const scene = await findCurrentScene({
    workspaceId: ctx.workspaceId,
    projectId: project.id,
    sceneId: request.sceneId,
  });
  requireMcp(
    scene &&
      scene.version.id === request.sceneVersionId &&
      scene.scene.currentVersion === request.expectedSceneVersion,
    "conflict",
    "The scene changed. Read its current version and prepare a new generation.",
  );
  let plan: SceneImageGenerationPlan | SceneAudioGenerationPlan | undefined;
  if (request.kind === "scene_image")
    await startSceneImageGeneration({
      workspaceId: ctx.workspaceId,
      requestedByUserId: ctx.principal.userId,
      project,
      previewOnly: true,
      inspectPlan: (p) => {
        plan = p;
      },
      request: { ...request, requestNonce: operationId, sizes: [request.size] },
    });
  else
    await startSceneAudioGeneration({
      workspaceId: ctx.workspaceId,
      requestedByUserId: ctx.principal.userId,
      project,
      previewOnly: true,
      inspectPlan: (p) => {
        plan = p;
      },
      voicePresetId: request.voicePresetId,
      sceneIds: [request.sceneId],
      requestNonce: operationId,
    });
  requireMcp(
    plan,
    "invalid_state",
    "The selected scene is not ready for generation.",
  );
  if ("provider" in plan) {
    requireMcp(
      ["openai", "gemini"].includes(plan.provider),
      "feature_unavailable",
      "MCP scene narration currently supports OpenAI and Gemini voice presets.",
    );
    if (plan.provider === "gemini")
      requireMcp(
        plan.model === getSpeechProviderEnvironment().GEMINI_TTS_MODEL,
        "conflict",
        "Update this voice preset to the configured Gemini model before preparing narration.",
      );
  }
  return plan;
}
function previewFor(
  request: McpGenerationRequest,
  plan: Awaited<ReturnType<typeof buildGenerationPlan>>,
): GenerationPreview {
  const image = "configuration" in plan;
  const text = image
    ? plan.configuration.prompt
    : "text" in plan
      ? plan.text
      : "";
  const model = image
    ? plan.configuration.model
    : "model" in plan
      ? plan.model
      : "";
  const provider = image ? "openai" : "provider" in plan ? plan.provider : "";
  return generationPreviewSchema.parse({
    kind: request.kind,
    title:
      "title" in request && request.title
        ? request.title
        : request.kind.replaceAll("_", " "),
    text,
    model,
    provider,
    estimatedCostCents: plan.estimatedCostCents,
    maximumCostCents: request.maximumCostCents,
    projectId: "projectId" in request ? request.projectId : null,
    sceneId: "sceneId" in request ? request.sceneId : null,
    settings: image
      ? [
          { label: "Size", value: plan.configuration.size },
          { label: "Quality", value: plan.configuration.quality },
          {
            label: "References",
            value: String(
              "references" in plan
                ? plan.references.length
                : "referenceAssetIds" in plan
                  ? plan.referenceAssetIds.length
                  : 0,
            ),
          },
        ]
      : [
          { label: "Voice", value: "voice" in plan ? plan.voice : "" },
          { label: "Format", value: "format" in plan ? plan.format : "" },
          {
            label: "Delivery instructions",
            value: "instructions" in plan ? plan.instructions : "",
          },
          {
            label: "Language",
            value: "language" in plan ? plan.language : "en-US",
          },
          ...("segmentCount" in plan
            ? [{ label: "Provider requests", value: String(plan.segmentCount) }]
            : []),
        ],
  });
}
const savedInputSchema = z.object({
  request: mcpGenerationRequestSchema,
  preview: generationPreviewSchema,
  authority: z.string(),
  planHash: z.string(),
  plan: z.record(z.string(), z.unknown()),
});

export async function prepareMcpGeneration(
  ctx: McpContext,
  key: string,
  request: McpGenerationRequest,
) {
  const requestHash = fingerprint({ kind: "generate_media", request });
  const previous = await findMcpOperationByKey(
    ctx.connection.id,
    ctx.workspaceId,
    key,
  );
  if (previous) {
    requireMcp(
      previous.kind === "generate_media" &&
        previous.fingerprint === requestHash,
      "conflict",
      "This idempotency key was used for different inputs.",
    );
    const saved = savedInputSchema.parse(previous.input);
    return {
      operation: publicOperation(previous),
      preview: saved.preview,
      approvalMode: effectiveGenerationApprovalMode({
        ...ctx.grant,
        role: ctx.membership.role,
      }),
      uiProof: undefined,
    };
  }
  const operationId = crypto.randomUUID();
  const plan = await buildGenerationPlan(ctx, request, operationId);
  requireMcp(
    plan.estimatedCostCents <= request.maximumCostCents,
    "budget_exceeded",
    "This estimate exceeds the maximum cost you authorized. Choose cheaper settings or explicitly raise the limit.",
  );
  const preview = previewFor(request, plan);
  const approvalMode = effectiveGenerationApprovalMode({
    ...ctx.grant,
    role: ctx.membership.role,
  });
  const proof =
    approvalMode === "manual" ? randomBytes(32).toString("hex") : undefined;
  const created = await beginMcpOperation({
    id: operationId,
    workspaceId: ctx.workspaceId,
    connectionId: ctx.connection.id,
    userId: ctx.principal.userId,
    kind: "generate_media",
    idempotencyKey: key,
    fingerprint: requestHash,
    status: proof ? "requires_approval" : "prepared",
    approvalHash: proof ? fingerprint(proof) : null,
    expiresAt: new Date(Date.now() + 600_000),
    input: {
      request,
      preview,
      plan,
      planHash: fingerprint(plan),
      authority: generationAuthority(ctx),
    },
  });
  requireMcp(
    created.operation.fingerprint === requestHash,
    "conflict",
    "That idempotency key was already used for different inputs.",
  );
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorUserId: ctx.principal.userId,
    action: "mcp_action_completed",
    targetType: "mcp_operation",
    targetId: created.operation.id,
    metadata: {
      kind: "generation_prepared",
      generationKind: request.kind,
      estimatedCostCents: plan.estimatedCostCents,
      approvalMode,
    },
  });
  return {
    operation: publicOperation(created.operation),
    preview: savedInputSchema.parse(created.operation.input).preview,
    approvalMode,
    uiProof: created.created ? proof : undefined,
  };
}
export async function executeMcpGeneration(
  ctx: McpContext,
  id: string,
  key: string,
) {
  const op = await ownedGeneration(ctx, id);
  requireMcp(
    op.idempotencyKey === key,
    "conflict",
    "Execute with the same idempotency key used to prepare this generation.",
  );
  requireMcp(
    effectiveGenerationApprovalMode({
      ...ctx.grant,
      role: ctx.membership.role,
    }) === "autonomous",
    "approval_required",
    "Enable autonomous generation for this connection and workspace, or approve through the review UI.",
  );
  return approveGeneration(ctx, op, undefined);
}
export async function approveMcpGeneration(
  ctx: McpContext,
  id: string,
  proof?: string,
  browser = false,
) {
  const op = await ownedGeneration(ctx, id);
  requireMcp(
    browser || (proof && op.approvalHash === fingerprint(proof)),
    "permission_denied",
    "A private, single-use review proof is required.",
  );
  // Browser approval is authenticated by the server action, never an MCP argument.
  return approveGeneration(ctx, op, op.approvalHash ?? undefined);
}
async function ownedGeneration(ctx: McpContext, id: string) {
  const op = await findMcpOperation({
    operationId: id,
    workspaceId: ctx.workspaceId,
    connectionId: ctx.connection.id,
    userId: ctx.principal.userId,
  });
  requireMcp(
    op?.kind === "generate_media",
    "not_found",
    "That generation is unavailable.",
  );
  return op;
}
async function approveGeneration(
  ctx: McpContext,
  op: McpOperation,
  proofHash: string | undefined,
) {
  if (op.status === "approved") return dispatchMcpGeneration(op);
  if (["queued", "running", "succeeded", "failed"].includes(op.status))
    return getMcpGenerationStatus(ctx, op.id);
  const saved = savedInputSchema.parse(op.input);
  requireMcp(
    op.expiresAt > new Date() && saved.authority === generationAuthority(ctx),
    "conflict",
    "This generation preview expired or its permissions changed. Prepare a fresh preview.",
  );
  const plan = await buildGenerationPlan(ctx, saved.request, op.id);
  requireMcp(
    fingerprint(plan) === saved.planHash,
    "conflict",
    "The content, references, voice or generation settings changed. Prepare a fresh preview.",
  );
  const consumed = await consumeMcpGeneration(ctx, op.id, proofHash);
  requireMcp(
    consumed,
    "conflict",
    "This review was used, expired or its authorization changed.",
  );
  await recordAuditEvent({
    workspaceId: ctx.workspaceId,
    actorUserId: ctx.principal.userId,
    action: "mcp_action_completed",
    targetType: "mcp_operation",
    targetId: op.id,
    metadata: {
      kind: "generation_authorized",
      approvalMode: proofHash ? "manual" : "autonomous",
      estimatedCostCents: saved.preview.estimatedCostCents,
    },
  });
  return dispatchMcpGeneration(consumed);
}
export async function dispatchMcpGeneration(op: McpOperation) {
  try {
    return await dispatchGeneration(op);
  } catch (error) {
    const known =
      error instanceof McpError ||
      error instanceof SceneImageGenerationRequestError ||
      error instanceof SceneAudioGenerationRequestError;
    const jobs = await listMcpGenerationJobs(op.workspaceId, op.id);
    const failed = known && jobs.length === 0;
    const updated = await updateMcpOperation({
      workspaceId: op.workspaceId,
      operationId: op.id,
      from: ["approved", "queued"],
      values: {
        ...(failed ? { status: "failed" as const } : {}),
        error: failed
          ? error.message
          : "The queue handoff could not be confirmed. Inspect this operation; autonomous clients may retry execute_generation with the SAME operation ID and idempotency key. Do not prepare a duplicate generation. Recovery can resume the saved handoff.",
      },
    });
    if (failed && updated) await settleMcpGeneration(op.workspaceId, op.id, 0);
    const current =
      updated ??
      (await findMcpOperation({
        workspaceId: op.workspaceId,
        operationId: op.id,
      })) ??
      op;
    return { ...publicOperation(current), jobs };
  }
}
async function dispatchGeneration(op: McpOperation) {
  requireMcp(
    op.expiresAt > new Date(),
    "expired",
    "This approved generation expired before dispatch.",
  );
  const ctx = await authorizeMcpBrowser(
    op.userId,
    op.connectionId,
    op.workspaceId,
    "vcstudio:generate",
  );
  const saved = savedInputSchema.parse(op.input);
  requireMcp(
    saved.authority === generationAuthority(ctx),
    "permission_denied",
    "Generation authorization changed before dispatch.",
  );
  const request = saved.request;
  if (request.kind === "image" || request.kind === "audio") {
    const budget = await loadEffectiveWorkspaceBudget({
      workspaceId: op.workspaceId,
    });
    await reserveMcpGeneration({
      workspaceId: op.workspaceId,
      operationId: op.id,
      estimatedCostCents: saved.preview.estimatedCostCents,
      maximumCostCents: request.maximumCostCents,
      dailyBudgetCents: budget.dailyBudgetCents,
      monthlyBudgetCents: budget.monthlyBudgetCents,
    });
    const taskId =
      request.kind === "image"
        ? "mcp-image-generation"
        : "mcp-audio-generation";
    const handle = await tasks.trigger(
      taskId,
      { workspaceId: op.workspaceId, operationId: op.id },
      { idempotencyKey: `mcp-generation:${op.id}` },
    );
    await updateMcpOperation({
      workspaceId: op.workspaceId,
      operationId: op.id,
      from: ["approved", "queued"],
      values: { status: "queued", triggerRunId: handle.id },
    });
  } else {
    const project = await requireMcpProject(
      ctx,
      request.projectId,
      request.kind === "scene_image"
        ? "generateSceneImages"
        : "generateSceneAudio",
    );
    const inspectPlan = (
      plan: SceneImageGenerationPlan | SceneAudioGenerationPlan,
    ) =>
      requireMcp(
        fingerprint(plan) === saved.planHash,
        "conflict",
        "The scene generation changed after preparation.",
      );
    if (request.kind === "scene_image")
      await startSceneImageGeneration({
        workspaceId: op.workspaceId,
        requestedByUserId: op.userId,
        project,
        mcpOperationId: op.id,
        inspectPlan,
        request: { ...request, requestNonce: op.id, sizes: [request.size] },
      });
    else {
      const audio = await startSceneAudioGeneration({
        workspaceId: op.workspaceId,
        requestedByUserId: op.userId,
        project,
        mcpOperationId: op.id,
        inspectPlan,
        voicePresetId: request.voicePresetId,
        sceneIds: [request.sceneId],
        requestNonce: op.id,
      });
      requireMcp(
        audio.reservedCount > 0,
        "generation_limit",
        "No narration was reserved. Check the scene's generation limit and project budget before preparing another request.",
      );
      if (!audio.dispatched) {
        await updateMcpOperation({
          workspaceId: op.workspaceId,
          operationId: op.id,
          from: ["approved"],
          values: {
            error:
              "Narration is reserved, but the queue handoff is not confirmed. Retry execute_generation with the same operation ID and key; no new reservation is needed.",
          },
        });
        return getMcpGenerationStatus(ctx, op.id);
      }
    }
    await updateMcpOperation({
      workspaceId: op.workspaceId,
      operationId: op.id,
      from: ["approved"],
      values: { status: "running", error: null },
    });
  }
  return getMcpGenerationStatus(ctx, op.id);
}
export async function getMcpGenerationStatus(ctx: McpContext, id: string) {
  let op = await ownedGeneration(ctx, id);
  const jobs = await listMcpGenerationJobs(ctx.workspaceId, id);
  const job = jobs[0];
  if (!job) op = await reconcileMcpGenerationWorker(op);
  if (
    job &&
    ["succeeded", "failed", "cancelled"].includes(job.status) &&
    ["approved", "running"].includes(op.status)
  )
    op =
      (await updateMcpOperation({
        workspaceId: ctx.workspaceId,
        operationId: id,
        from: ["approved", "running"],
        values: {
          status: job.status === "succeeded" ? "succeeded" : "failed",
          error: job.error,
          result: {
            generationId: job.id,
            projectId: job.projectId,
            sceneId: job.sceneId,
            actualCostCents: job.actualCostCents,
            href: `/app/projects/${job.projectId}/scenes?sceneId=${job.sceneId}`,
          },
        },
      })) ?? op;
  return { ...publicOperation(op), jobs };
}

/** Re-evaluate saved authority immediately before a queued worker can spend. */
export async function assertMcpGenerationWorkerAccess(
  workspaceId: string,
  id: string,
) {
  const op = await findMcpOperation({ workspaceId, operationId: id });
  requireMcp(
    op?.kind === "generate_media" &&
      ["approved", "queued", "running"].includes(op.status) &&
      op.expiresAt > new Date(),
    "permission_denied",
    "The generation authorization is no longer active.",
  );
  const ctx = await authorizeMcpBrowser(
    op.userId,
    op.connectionId,
    workspaceId,
    "vcstudio:generate",
  );
  const saved = savedInputSchema.parse(op.input);
  requireMcp(
    saved.authority === generationAuthority(ctx),
    "permission_denied",
    "The generation grant changed before provider submission.",
  );
  if (
    saved.request.kind === "scene_image" ||
    saved.request.kind === "scene_audio"
  ) {
    const scene = await findCurrentScene({
      workspaceId,
      projectId: saved.request.projectId,
      sceneId: saved.request.sceneId,
    });
    requireMcp(
      scene &&
        scene.scene.status === "approved" &&
        scene.version.id === saved.request.sceneVersionId &&
        scene.scene.currentVersion === saved.request.expectedSceneVersion,
      "conflict",
      "The scene changed before provider submission.",
    );
  }
  return op;
}
