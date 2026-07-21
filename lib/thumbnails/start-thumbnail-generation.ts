import "server-only";

import { tasks } from "@trigger.dev/sdk";
import {
  renderThumbnailPrompt,
  THUMBNAIL_PROMPT_TEMPLATE_SOURCE_HASH,
  THUMBNAIL_PROMPT_VERSION,
} from "@studio/prompts";
import type { Project, ProjectBrief } from "@/db/schema";
import {
  attachThumbnailGenerationTriggerRun,
  createThumbnailGenerationReservation,
  failThumbnailGeneration,
} from "@/db/commands/thumbnail-generation-commands";
import {
  ensureThumbnailPromptTemplate,
  findThumbnailGenerationByIdempotencyKey,
} from "@/db/repositories/thumbnail-generation.repository";
import {
  findApprovedScriptVersion,
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
} from "@/db/repositories/scenes.repository";
import { loadEffectiveWorkspaceBudget } from "@/lib/budgets/workspace-budget";
import { estimateSceneImageCost } from "@/lib/costs/scene-image-cost";
import { BudgetExceededError } from "@/lib/domain/errors";
import {
  createRequestFingerprint,
  createThumbnailGenerationIdempotencyKey,
} from "@/lib/domain/idempotency";
import {
  getSceneAnalysisEnvironment,
  getSceneImageEnvironment,
} from "@/lib/env/server";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import { getSceneImageDimensions } from "@/lib/schemas/scene-image";
import {
  getThumbnailSizeForPlatform,
  type ThumbnailTextMode,
} from "@/lib/schemas/thumbnail";
import { contentPlatformSchema } from "@/lib/schemas/title-generation";
import type { ContentPlatformValue } from "@/lib/schemas/title-generation";
import { createSceneImageOutputCostMatrix } from "@/lib/scenes/scene-image-configuration";
import type { thumbnailGenerationTask } from "@/trigger/thumbnail-generation";

export class ThumbnailGenerationRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ThumbnailGenerationRequestError";
  }
}

export async function startThumbnailGeneration(input: {
  workspaceId: string;
  project: Project;
  brief: ProjectBrief | null;
  platform: ContentPlatformValue;
  textMode: ThumbnailTextMode;
  headlineText: string;
  requestedByUserId: string;
  requestNonce: string;
}): Promise<{ thumbnailGenerationId: string; created: boolean }> {
  const platform = contentPlatformSchema.parse(input.platform);
  const imageEnvironment = getSceneImageEnvironment();
  const textEnvironment = getSceneAnalysisEnvironment();
  if (!imageEnvironment.ENABLE_SCENE_IMAGE_GENERATION)
    throw new ThumbnailGenerationRequestError("Image generation is disabled.");

  await enforceRateLimit({
    workspaceId: input.workspaceId,
    operation: "thumbnail_generation",
  });

  const headline =
    input.textMode === "baked" ? input.headlineText.trim() : null;
  if (input.textMode === "baked" && (headline === null || headline === ""))
    throw new ThumbnailGenerationRequestError(
      "Add a headline, or switch to a text-free thumbnail.",
    );

  const brief = input.brief;
  const approvedScript = await findApprovedScriptVersion({
    workspaceId: input.workspaceId,
    projectId: input.project.id,
  });
  const hasTopic = Boolean(brief && brief.topic.trim() !== "");
  if (!hasTopic && !approvedScript)
    throw new ThumbnailGenerationRequestError(
      "Add a topic to the brief or approve a script before generating thumbnails.",
    );

  // Image prompts are source-hash gated: if the template row in the database
  // disagrees with the code, previous generations are no longer reproducible, so
  // refuse rather than silently spend against a different prompt.
  const promptTemplate = await ensureThumbnailPromptTemplate();
  if (promptTemplate.sourceHash !== THUMBNAIL_PROMPT_TEMPLATE_SOURCE_HASH)
    throw new ThumbnailGenerationRequestError(
      "The thumbnail prompt template is unavailable.",
    );

  const size = getThumbnailSizeForPlatform(platform);
  const dimensions = getSceneImageDimensions(size);
  const finalPrompt = renderThumbnailPrompt({
    platform,
    topic: brief?.topic ?? "",
    targetAudience: brief?.targetAudience ?? "",
    tone: brief?.tone ?? "",
    hookAngle: brief?.hookAngle ?? "",
    title: null,
    scriptExcerpt: approvedScript?.content ?? null,
    textMode: input.textMode,
    headlineText: headline,
    output: dimensions,
  });

  const quality = imageEnvironment.OPENAI_IMAGE_FINAL_QUALITY;
  const estimate = estimateSceneImageCost({
    prompt: finalPrompt,
    quality,
    size,
    referenceAssetCount: 0,
    outputCostMatrix: createSceneImageOutputCostMatrix(imageEnvironment),
    textInputCostPerMillionCents:
      imageEnvironment.OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS,
    referenceInputReserveCents:
      imageEnvironment.OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET,
    safetyMarginBasisPoints: 0,
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
    textEnvironment.REQUEST_FINGERPRINT_SECRET,
    JSON.stringify({
      platform,
      topic: brief?.topic ?? "",
      targetAudience: brief?.targetAudience ?? "",
      tone: brief?.tone ?? "",
      hookAngle: brief?.hookAngle ?? "",
      scriptVersionId: approvedScript?.id ?? null,
    }),
  );
  const idempotencyKey = createThumbnailGenerationIdempotencyKey({
    secret: textEnvironment.IDEMPOTENCY_HASH_SECRET,
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    platform,
    textMode: input.textMode,
    headlineText: headline ?? "",
    briefFingerprint,
    model: imageEnvironment.OPENAI_IMAGE_MODEL,
    quality,
    size,
    promptVersion: THUMBNAIL_PROMPT_VERSION,
    requestNonce: input.requestNonce,
  });
  const existing =
    await findThumbnailGenerationByIdempotencyKey(idempotencyKey);
  if (existing) return { thumbnailGenerationId: existing.id, created: false };

  const thumbnailGenerationId = crypto.randomUUID();
  await createThumbnailGenerationReservation({
    id: thumbnailGenerationId,
    reservationId: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.project.id,
    userId: input.requestedByUserId,
    platform,
    textMode: input.textMode,
    headlineText: headline,
    scriptVersionId: approvedScript?.id ?? null,
    promptTemplateVersionId: promptTemplate.id,
    promptTemplateVersion: THUMBNAIL_PROMPT_VERSION,
    finalPrompt,
    idempotencyKey,
    requestFingerprint: createRequestFingerprint(
      textEnvironment.REQUEST_FINGERPRINT_SECRET,
      finalPrompt,
    ),
    model: imageEnvironment.OPENAI_IMAGE_MODEL,
    quality,
    size,
    outputFormat: imageEnvironment.OPENAI_IMAGE_OUTPUT_FORMAT,
    outputCompression: imageEnvironment.OPENAI_IMAGE_FINAL_COMPRESSION,
    background: imageEnvironment.OPENAI_IMAGE_BACKGROUND,
    estimatedCostCents: estimate.estimatedCostCents,
    expiresAt: new Date(
      Date.now() +
        textEnvironment.GENERATION_RESERVATION_EXPIRY_MINUTES * 60_000,
    ),
    budget: {
      workspaceDailyLimitCents: effectiveBudget.dailyBudgetCents,
      workspaceMonthlyLimitCents: effectiveBudget.monthlyBudgetCents,
      dailyWindowStart: startOfDay,
      monthlyWindowStart: startOfMonth,
    },
  });

  try {
    const handle = await tasks.trigger<typeof thumbnailGenerationTask>(
      "thumbnail-generation",
      {
        thumbnailGenerationId,
        workspaceId: input.workspaceId,
        projectId: input.project.id,
      },
      { idempotencyKey },
    );
    await attachThumbnailGenerationTriggerRun({
      thumbnailGenerationId,
      triggerRunId: handle.id,
    });
  } catch (error) {
    await failThumbnailGeneration({
      thumbnailGenerationId,
      category: "trigger_error",
      message: "Thumbnail generation could not be queued.",
    });
    throw error;
  }

  return { thumbnailGenerationId, created: true };
}
