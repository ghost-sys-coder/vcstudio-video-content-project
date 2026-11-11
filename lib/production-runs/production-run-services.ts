import "server-only";

import { createHash } from "node:crypto";
import { commitScriptVersion } from "@/db/commands/commit-script-version";
import {
  appendProductionRunEvent,
  finishProductionRun,
  holdProductionRun,
  recordProductionRunGateResults,
  updateProductionRunCursor,
} from "@/db/commands/production-run-commands";
import { saveReleasePackageDraft } from "@/db/commands/release-package-commands";
import { approveSceneAudioGeneration } from "@/db/commands/scene-audio-commands";
import { approveAllScenes } from "@/db/commands/scene-commands";
import { approveSceneImageGeneration } from "@/db/commands/scene-image-commands";
import { saveScriptDraft } from "@/db/commands/script-commands";
import { listProjectOutputVariants } from "@/db/repositories/output-variants.repository";
import { findProductionRun } from "@/db/repositories/production-runs.repository";
import { findProjectBrief } from "@/db/repositories/project-briefs.repository";
import {
  findProject,
  findProjectScriptDraft,
} from "@/db/repositories/projects.repository";
import { listReleasePackagesForProject } from "@/db/repositories/release-packages.repository";
import { findSceneImageBatch } from "@/db/repositories/scene-image-batches.repository";
import {
  findDefaultStylePresetVersion,
  findStylePresetVersion,
} from "@/db/repositories/scene-images.repository";
import { findScriptGenerationRunById } from "@/db/repositories/script-generation.repository";
import {
  findThumbnailGenerationById,
  listProjectThumbnails,
} from "@/db/repositories/thumbnail-generation.repository";
import {
  findLatestCompletedTitleGenerationRunForPlatform,
  findTitleGenerationRunById,
  listTitleSuggestionsForRuns,
} from "@/db/repositories/title-generation.repository";
import { startSceneAudioGeneration } from "@/lib/audio/start-scene-audio-generation";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { getSceneImageEnvironment } from "@/lib/env/server";
import { loadProductionRunFacts } from "@/lib/production-runs/load-production-run-facts";
import type { ProductionRunServices } from "@/lib/production-runs/execute-production-step";
import { startVideoRender } from "@/lib/render/start-video-render";
import { startBulkSceneImageGeneration } from "@/lib/scenes/start-bulk-scene-image-generation";
import { startApprovedSceneAnalysis } from "@/lib/scenes/start-approved-scene-analysis";
import { createSceneImageOutputCostMatrix } from "@/lib/scenes/scene-image-configuration";
import { getSceneImageSizeForAspectRatio } from "@/lib/schemas/scene-image";
import { startScriptGeneration } from "@/lib/scripts/start-script-generation";
import { startThumbnailGeneration } from "@/lib/thumbnails/start-thumbnail-generation";
import { startTitleGeneration } from "@/lib/titles/start-title-generation";
import { isVideoContentPlatform } from "@/lib/platforms/video-content-platforms";

class ProductionRunServiceError extends Error {
  constructor(message: string) {
    super(message);
    // Classified as a hold by name, like the stage services' own errors.
    this.name = "VideoRenderRequestError";
  }
}

function deterministicUuid(seed: string): string {
  const value = createHash("sha256").update(seed).digest("hex").slice(0, 32);
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    `4${value.slice(13, 16)}`,
    `8${value.slice(17, 20)}`,
    value.slice(20),
  ].join("-");
}

/**
 * The real wiring for a production run: every start is the service a
 * creator's own click calls, so budgets, idempotency, rate limits and audit
 * all apply exactly as they do by hand.
 */
export const productionRunServices: ProductionRunServices = {
  findRun: findProductionRun,
  findProject,
  loadFacts: loadProductionRunFacts,

  nonce: ({ runId, stage, attempt }) =>
    deterministicUuid(`production-run:${runId}:${stage}:${attempt}`),

  async startScriptGeneration({ workspaceId, project, userId, requestNonce }) {
    const brief = await findProjectBrief({
      workspaceId,
      projectId: project.id,
    });
    const started = await startScriptGeneration({
      workspaceId,
      project,
      brief,
      requestedByUserId: userId,
      requestNonce,
    });
    const row = await findScriptGenerationRunById(started.runId);
    return {
      runId: started.runId,
      estimatedCostCents: started.created ? (row?.estimatedCostCents ?? 0) : 0,
    };
  },

  async approveScript({
    workspaceId,
    projectId,
    userId,
    content,
    draftRevision,
  }) {
    const scope = { workspaceId, projectId };
    const draft = await findProjectScriptDraft(scope);
    let revision = draft?.revision ?? draftRevision;
    if ((draft?.content ?? "") !== content) {
      const saved = await saveScriptDraft({
        ...scope,
        content,
        revision,
        userId,
      });
      revision = saved.revision;
    }
    const committed = await commitScriptVersion({
      ...scope,
      userId,
      revision,
      content,
      approve: true,
    });
    return { versionId: committed.id };
  },

  async startSceneAnalysis({ workspaceId, project, userId }) {
    const started = await startApprovedSceneAnalysis({
      workspaceId,
      project,
      requestedByUserId: userId,
    });
    return {
      analysisRunId: started.analysisRunId ?? "",
      estimatedCostCents: started.estimatedCostCents,
    };
  },

  approveAllScenes,

  async estimateImages({ project, sceneCount, quality }) {
    const environment = getSceneImageEnvironment();
    const matrix = createSceneImageOutputCostMatrix(environment);
    const size = getSceneImageSizeForAspectRatio(project.aspectRatio);
    // Output cost per image plus a flat allowance for prompt tokens and
    // references; the batch itself prices exactly and is recorded afterwards.
    const perImage =
      matrix[quality][size] +
      environment.OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET;
    return perImage * sceneCount;
  },

  async startImages({
    workspaceId,
    project,
    userId,
    sceneIds,
    quality,
    requestNonce,
  }) {
    const style = project.stylePresetVersionId
      ? await findStylePresetVersion({
          workspaceId,
          stylePresetVersionId: project.stylePresetVersionId,
        })
      : await findDefaultStylePresetVersion({ workspaceId });
    if (!style)
      throw new ProductionRunServiceError(
        "No visual style is available. Set a workspace default style first.",
      );
    const result = await startBulkSceneImageGeneration({
      workspaceId,
      requestedByUserId: userId,
      project,
      request: {
        projectId: project.id,
        stylePresetVersionId: style.version.id,
        quality,
        requestNonce,
        sceneIds,
        sizes: [getSceneImageSizeForAspectRatio(project.aspectRatio)],
      },
    });
    const batch = await findSceneImageBatch({
      workspaceId,
      projectId: project.id,
      batchId: result.batchId,
    });
    return {
      batchId: result.batchId,
      reservedCount: result.reservedCount,
      estimatedCostCents: result.created ? (batch?.estimatedCostCents ?? 0) : 0,
    };
  },

  async approveImage(input) {
    await approveSceneImageGeneration(input);
  },

  async estimateAudio({
    workspaceId,
    project,
    userId,
    sceneIds,
    voicePresetId,
  }) {
    let total = 0;
    await startSceneAudioGeneration({
      workspaceId,
      requestedByUserId: userId,
      project,
      voicePresetId,
      sceneIds,
      requestNonce: deterministicUuid(
        `estimate:${project.id}:${sceneIds.join(",")}`,
      ),
      previewOnly: true,
      inspectPlan: (plan) => {
        total += plan.estimatedCostCents;
      },
    });
    return total;
  },

  async startAudio({
    workspaceId,
    project,
    userId,
    sceneIds,
    voicePresetId,
    requestNonce,
  }) {
    let estimated = 0;
    const result = await startSceneAudioGeneration({
      workspaceId,
      requestedByUserId: userId,
      project,
      voicePresetId,
      sceneIds,
      requestNonce,
      inspectPlan: (plan) => {
        estimated += plan.estimatedCostCents;
      },
    });
    return {
      reservedCount: result.reservedCount,
      estimatedCostCents: estimated,
    };
  },

  async approveAudio(input) {
    await approveSceneAudioGeneration(input);
  },

  async startRender({ workspaceId, project, userId, requestNonce }) {
    const variants = await listProjectOutputVariants({
      workspaceId,
      projectId: project.id,
    });
    const primary = variants.find(
      (variant) => variant.aspectRatio === project.aspectRatio,
    );
    if (!primary)
      throw new ProductionRunServiceError(
        "The project has no output in its own aspect ratio to render.",
      );
    const render = await startVideoRender({
      workspaceId,
      requestedByUserId: userId,
      project,
      outputVariantId: primary.id,
      includeCaptions: true,
      includeWatermark: false,
      requestNonce,
    });
    return {
      renderId: render.renderId,
      estimatedCostCents: render.created ? render.estimatedCostCents : 0,
    };
  },

  async startTitles({ workspaceId, project, userId, platform, requestNonce }) {
    if (!isVideoContentPlatform(platform))
      throw new ProductionRunServiceError(
        "The project's channel platform does not take a video release.",
      );
    const brief = await findProjectBrief({
      workspaceId,
      projectId: project.id,
    });
    const started = await startTitleGeneration({
      workspaceId,
      project,
      brief,
      platform,
      optionCount: 5,
      requestedByUserId: userId,
      requestNonce,
    });
    const row = await findTitleGenerationRunById(started.runId);
    return {
      runId: started.runId,
      estimatedCostCents: started.created ? (row?.estimatedCostCents ?? 0) : 0,
    };
  },

  async startThumbnail({
    workspaceId,
    project,
    userId,
    platform,
    requestNonce,
  }) {
    if (!isVideoContentPlatform(platform))
      throw new ProductionRunServiceError(
        "The project's channel platform does not take a video release.",
      );
    const brief = await findProjectBrief({
      workspaceId,
      projectId: project.id,
    });
    const started = await startThumbnailGeneration({
      workspaceId,
      project,
      brief,
      platform,
      textMode: "clean",
      headlineText: "",
      requestedByUserId: userId,
      requestNonce,
    });
    const row = await findThumbnailGenerationById(
      started.thumbnailGenerationId,
    );
    return {
      thumbnailGenerationId: started.thumbnailGenerationId,
      estimatedCostCents: started.created ? (row?.estimatedCostCents ?? 0) : 0,
    };
  },

  async saveReleasePackage({ workspaceId, project, userId, platform }) {
    if (!isVideoContentPlatform(platform))
      throw new ProductionRunServiceError(
        "The project's channel platform does not take a video release.",
      );
    const scope = { workspaceId, projectId: project.id };
    const [variants, titleRun, thumbnails, packages] = await Promise.all([
      listProjectOutputVariants(scope),
      findLatestCompletedTitleGenerationRunForPlatform({ ...scope, platform }),
      listProjectThumbnails({ ...scope, platform, limit: 20 }),
      listReleasePackagesForProject(scope),
    ]);
    const primary = variants.find(
      (variant) => variant.aspectRatio === project.aspectRatio,
    );
    if (!primary)
      throw new ProductionRunServiceError(
        "The project has no output in its own aspect ratio to package.",
      );
    const suggestions = titleRun
      ? await listTitleSuggestionsForRuns({
          ...scope,
          titleGenerationRunIds: [titleRun.id],
        })
      : [];
    const title =
      suggestions.find((s) => s.isFavorite) ?? suggestions[0] ?? null;
    const usable = thumbnails.filter(
      (row) => row.status === "succeeded" && row.assetObjectKey !== null,
    );
    const thumbnail = usable.find((row) => row.isFavorite) ?? usable[0] ?? null;
    const identity = {
      workspaceId,
      projectId: project.id,
      outputVariantId: primary.id,
      shortCompositionId: null,
      platform,
      channelProfileId: project.channelProfileId,
    };
    const existing = packages.find(
      (row) =>
        row.package.outputVariantId === identity.outputVariantId &&
        row.package.shortCompositionId === null &&
        row.package.platform === platform &&
        row.package.channelProfileId === identity.channelProfileId,
    );
    const saved = await saveReleasePackageDraft({
      identity,
      content: {
        title: existing?.package.title.trim() || title?.text || "",
        titleSuggestionId: existing?.package.title.trim()
          ? existing.package.titleSuggestionId
          : (title?.id ?? null),
        description:
          existing?.package.description.trim() ||
          titleRun?.generatedDescription ||
          "",
        tags: existing?.package.tags.length
          ? existing.package.tags
          : (titleRun?.generatedTags ?? []).slice(0, 30),
        visibility: existing?.package.visibility ?? "platform_default",
        thumbnailGenerationId:
          existing?.package.thumbnailGenerationId ?? thumbnail?.id ?? null,
        caption:
          existing?.package.caption ??
          (platform === "instagram" ? (title?.text ?? null) : null),
        shareToFeed: existing?.package.shareToFeed ?? null,
        plannedReleaseAt:
          existing?.package.plannedReleaseAt ?? project.plannedReleaseAt,
        // Deliberately left for a person: these are declarations to YouTube.
        madeForKids: existing?.package.madeForKids ?? null,
        containsSyntheticMedia:
          existing?.package.containsSyntheticMedia ?? null,
        youtubePlaylistId: existing?.package.youtubePlaylistId ?? null,
      },
      expectedRevision: existing?.package.revision ?? null,
      actorUserId: userId,
    });
    return { releasePackageId: saved.id };
  },

  updateCursor: updateProductionRunCursor,
  hold: holdProductionRun,
  finish: finishProductionRun,
  appendEvent: appendProductionRunEvent,
  recordGates: recordProductionRunGateResults,
  async audit({
    workspaceId,
    projectId,
    actorUserId,
    action,
    runId,
    metadata,
  }) {
    await recordAuditEvent({
      workspaceId,
      actorUserId,
      projectId,
      action,
      targetType: "production_run",
      targetId: runId,
      metadata,
    });
  },
};
