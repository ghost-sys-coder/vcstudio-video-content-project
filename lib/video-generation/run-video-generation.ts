import "server-only";
import { createHash } from "node:crypto";
import { prepareVideoReference } from "./prepare-video-reference";
import { findVideoGeneration } from "@/db/repositories/video-generations.repository";
import { findMediaAsset } from "@/db/repositories/media-assets.repository";
import { findWorkspaceMembership } from "@/db/repositories/workspaces.repository";
import { findCurrentScene } from "@/db/repositories/scenes.repository";
import { findProject } from "@/db/repositories/projects.repository";
import { findApprovedSceneVideoReference } from "@/db/repositories/scene-video-reference.repository";
import {
  updateVideoGeneration,
  settleVideoGeneration,
} from "@/db/commands/video-generation-commands";
import { saveGeneratedVideoAsset } from "@/db/commands/generated-video-asset-command";
import { getVideoGenerationEnvironment } from "@/lib/env/server";
import { can } from "@/lib/policies/workspace-policy";
import {
  downloadSceneStillBytes,
  putSceneClip,
} from "@/lib/storage/scene-clip-storage";
import { sealSecret } from "@/lib/crypto/secret-box";
import { createVideoProvider } from "./video-provider-registry";
import { VideoProviderError, type VideoProviderState } from "./video-provider";
import { planVideoGeneration } from "./plan-video-generation";
import { prepareVideoOutput } from "./prepare-video-output";
import { getVideoSecurityEnvironment } from "./video-security";
import { measuredVideoCost } from "./video-cost";
import { MAX_VIDEO_BYTES } from "./providers/provider-http";

function outputAssetId(id: string) {
  const hex = createHash("sha256")
    .update(`video-library-output:${id}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
/** Retries resume the persisted handle. The billable POST is claimed once only. */
export async function runVideoGeneration(
  input: { workspaceId: string; generationId: string },
  waitForPoll: () => Promise<void>,
) {
  let job = await findVideoGeneration(input);
  if (!job) return { status: "missing" };
  if (job.status === "succeeded") {
    if (job.actualCostCents !== null)
      await settleVideoGeneration({
        ...input,
        actualCostCents: job.actualCostCents,
      });
    else if (job.providerJobId) {
      // Billing may settle after the media. An explicit resume checks that same
      // handle without downloading again or ever submitting another generation.
      const state = await createVideoProvider(job.modelSnapshot.provider).check(
        job.providerJobId,
      );
      if (state.status === "succeeded") {
        const cost = measuredVideoCost(job.pricingSnapshot, state.usage);
        if (cost !== null)
          await settleVideoGeneration({ ...input, actualCostCents: cost });
      }
    }
    return { status: job.status };
  }
  if (["cancelled", "failed"].includes(job.status))
    return { status: job.status };
  let submitted = Boolean(job.providerJobId) || job.status !== "queued";
  let accepted = Boolean(job.providerJobId);
  try {
    const plan = planVideoGeneration({
      request: job.request,
      model: job.modelSnapshot,
      pricing: job.pricingSnapshot,
    });
    const provider = createVideoProvider(job.modelSnapshot.provider);
    let state: VideoProviderState;
    if (job.providerJobId) state = await provider.check(job.providerJobId);
    else {
      if (job.status !== "queued")
        throw new VideoProviderError(
          "submission_requires_reconciliation",
          false,
        );
      const membership = await findWorkspaceMembership({
        workspaceId: job.workspaceId,
        userId: job.requestedByUserId,
      });
      if (
        !getVideoGenerationEnvironment().ENABLE_VIDEO_GENERATION ||
        !membership ||
        !can(membership.role, "mutateWorkspaceData")
      )
        throw new VideoProviderError("generation_no_longer_authorized", true);
      if (Date.now() - job.createdAt.getTime() > 2 * 60 * 60 * 1000)
        throw new VideoProviderError("queued_request_expired", true);
      if (job.request.target.kind === "scene") {
        const target = job.request.target;
        const [current, project] = await Promise.all([
          findCurrentScene({
            ...input,
            projectId: target.projectId,
            sceneId: target.sceneId,
          }),
          findProject({ ...input, projectId: target.projectId }),
        ]);
        if (
          !project ||
          project.archivedAt ||
          !current ||
          current.version.id !== target.sceneVersionId ||
          current.scene.currentVersion !== target.expectedSceneVersion
        )
          throw new VideoProviderError("scene_changed_before_submission", true);
      }
      const assets = await Promise.all(
        job.inputAssets.map(async (source) => {
          if (source.source === "scene_image") {
            if (job!.request.target.kind !== "scene")
              throw new VideoProviderError("input_scene_mismatch", true);
            const image = await findApprovedSceneVideoReference({
              workspaceId: job!.workspaceId,
              projectId: job!.request.target.projectId,
              sceneVersionId: job!.request.target.sceneVersionId,
              generationId: source.assetId,
            });
            if (!image?.objectKey || image.objectKey !== source.objectKey)
              throw new VideoProviderError("scene_reference_changed", true);
            const bytes = Buffer.from(
              await downloadSceneStillBytes({
                objectKey: source.objectKey,
                maximumBytes: 10 * 1024 * 1024,
              }),
            );
            return {
              role: source.role,
              contentType: "image/png",
              bytes: await prepareVideoReference({
                bytes,
                mode: job!.request.mode,
                fit: job!.request.fit,
                width: plan.width,
                height: plan.height,
              }),
            };
          }
          const asset = await findMediaAsset({
            workspaceId: job!.workspaceId,
            mediaAssetId: source.assetId,
          });
          if (
            !asset ||
            asset.status !== "ready" ||
            asset.deletedAt ||
            asset.kind !== "image" ||
            asset.objectKey !== source.objectKey
          )
            throw new VideoProviderError("input_asset_unavailable", true);
          const bytes = Buffer.from(
            await downloadSceneStillBytes({
              objectKey: source.objectKey,
              maximumBytes: 10 * 1024 * 1024,
            }),
          );
          // Actual decoder validation and normalization, not a filename/MIME claim.
          const normalized = await prepareVideoReference({
            bytes,
            mode: job!.request.mode,
            fit: job!.request.fit,
            width: plan.width,
            height: plan.height,
          });
          return {
            role: source.role,
            contentType: "image/png",
            bytes: normalized,
          };
        }),
      );
      if (
        assets.reduce((total, asset) => total + asset.bytes.byteLength, 0) >
        12 * 1024 * 1024
      )
        throw new VideoProviderError("decoded_reference_size_limit", true);
      const claimed = await updateVideoGeneration({
        ...input,
        from: ["queued"],
        values: {
          status: "submitting",
          attemptCount: 1,
          startedAt: new Date(),
          safeErrorMessage: null,
          errorCode: null,
        },
      });
      if (!claimed) return { status: "claimed_elsewhere" };
      submitted = true;
      state = await provider.start({
        request: job.request,
        model: job.modelSnapshot,
        finalPrompt: job.finalPrompt,
        assets,
      });
      accepted = true;
      await updateVideoGeneration({
        ...input,
        from: ["submitting", "requires_reconciliation"],
        values: {
          status: "running",
          providerJobId: state.jobId,
          providerRequestId: state.requestId,
        },
      });
    }
    for (let poll = 0; poll < 120; poll++) {
      if (state.status !== "running") break;
      await waitForPoll();
      state = await provider.check(state.jobId);
    }
    if (state.status === "running")
      throw new VideoProviderError(
        "provider_poll_timeout",
        false,
        state.requestId,
      );
    if (state.status === "failed")
      throw new VideoProviderError(state.code, false, state.requestId);
    // URI credentials are encrypted and never become task payloads or logs.
    await updateVideoGeneration({
      ...input,
      from: ["running", "inspecting", "requires_reconciliation"],
      values: {
        status: "inspecting",
        encryptedOutput:
          state.output.kind === "uri"
            ? sealSecret({
                plaintext: state.output.uri,
                key: getVideoSecurityEnvironment()
                  .PLATFORM_TOKEN_ENCRYPTION_KEY,
              })
            : null,
        inputUnits: state.usage?.inputTokens ?? null,
        outputUnits:
          state.usage?.creditsCharged ?? state.usage?.outputTokens ?? null,
      },
    });
    const bytes =
      state.output.kind === "inline"
        ? state.output.bytes
        : await provider.download(state.output.uri);
    const output = await prepareVideoOutput({
      bytes,
      mute: plan.muteOutput,
      maximumDurationSeconds: plan.reservationDurationSeconds,
      width: plan.width,
      height: plan.height,
    });
    const actualCostCents = ["google_gemini", "luma"].includes(
      job.modelSnapshot.provider,
    )
      ? measuredVideoCost(job.pricingSnapshot, state.usage)
      : plan.estimatedCostCents;
    const assetId = outputAssetId(job.id),
      objectKey = `workspaces/${job.workspaceId}/media/${assetId}/generated.mp4`;
    await putSceneClip({
      objectKey,
      generationId: job.id,
      bytes: output.bytes,
      contentType: "video/mp4",
      providerRequestId: state.requestId,
      actualCostCents: actualCostCents ?? plan.estimatedCostCents,
      durationMilliseconds: output.metadata.durationMilliseconds,
      maximumBytes: MAX_VIDEO_BYTES,
    });
    await saveGeneratedVideoAsset({
      ...input,
      assetId,
      objectKey,
      sizeBytes: output.bytes.byteLength,
      title: job.request.title,
      userId: job.requestedByUserId,
      metadata: output.metadata,
      warnings: output.warnings,
      actualCostCents,
    });
    if (actualCostCents !== null)
      await settleVideoGeneration({ ...input, actualCostCents });
    return { status: "succeeded", assetId };
  } catch (error) {
    const unbilled =
      !submitted ||
      (error instanceof VideoProviderError &&
        error.definitelyUnbilled &&
        !accepted);
    const code =
      error instanceof VideoProviderError
        ? error.code
        : submitted
          ? "video_processing_requires_attention"
          : "video_preflight_failed";
    job = await updateVideoGeneration({
      ...input,
      from: [
        "queued",
        "submitting",
        "running",
        "inspecting",
        "requires_reconciliation",
      ],
      values: {
        status: unbilled ? "failed" : "requires_reconciliation",
        errorCode: code,
        safeErrorMessage: unbilled
          ? "Video could not start. Check model access and reference assets; no generation charge was recorded."
          : "This operation needs attention. Its estimate remains reserved. Resume the existing provider job when available; do not submit a duplicate.",
        ...(unbilled ? { completedAt: new Date() } : {}),
        encryptedOutput: null,
      },
    });
    if (unbilled && job)
      await settleVideoGeneration({ ...input, actualCostCents: 0 });
    return { status: unbilled ? "failed" : "requires_reconciliation", code };
  }
}
