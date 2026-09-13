import { logger, task, wait } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  claimSceneClipRunning,
  completeSceneClipGeneration,
  failSceneClipGeneration,
  recordSceneClipProviderJob,
  updateSceneClipProgress,
} from "@/db/commands/scene-video-commands";
import { findPromptTemplateVersion } from "@/db/repositories/scene-images.repository";
import { findSceneClipGeneration } from "@/db/repositories/scene-videos.repository";
import { findSceneImageGeneration } from "@/db/repositories/scene-images.repository";
import { getSceneVideoEnvironment } from "@/lib/env/server";
import { verifyPromptTemplate } from "@/lib/prompts/prompt-template-registry";
import { createSceneClipObjectKey } from "@/lib/storage/object-key";
import {
  downloadSceneStillBytes,
  putSceneClip,
} from "@/lib/storage/scene-clip-storage";
import { OpenAiVideoProvider } from "@/lib/video-models/providers/openai-video-provider";
import { VideoGenerationProviderError } from "@/lib/video-models/video-generation-provider";

export const sceneVideoGenerationTaskPayloadSchema = z.object({
  generationId: z.uuid(),
  workspaceId: z.uuid(),
  projectId: z.uuid(),
});

type SceneVideoTaskPayload = z.infer<
  typeof sceneVideoGenerationTaskPayloadSchema
>;

/** Video models run for minutes, so this polls rather than blocking on a call. */
const POLL_SECONDS = 10;
const MAX_WAIT_SECONDS = 900;
/** A few seconds of 720p video. Anything far past this is not our clip. */
const MAX_CLIP_BYTES = 200 * 1024 * 1024;
const MAX_STILL_BYTES = 25 * 1024 * 1024;

/**
 * Turns an approved still into a short clip.
 *
 * **Why the shape of this task is polling rather than awaiting.** These models
 * take minutes. The vendor's job handle is written to the row as soon as it
 * exists, so a worker that dies mid-flight leaves behind enough for a
 * replacement, or for a person, to find the work rather than pay for it twice.
 *
 * **Why every failure path goes through `failSceneClipGeneration`.** That is
 * what releases the reservation. A task that threw instead would leave money
 * reserved against a job that will never finish, and the budget would shrink by
 * the size of every failure until someone noticed.
 */
export const sceneVideoGenerationTask = task({
  id: "scene-video-generation",
  queue: { name: "video-generation", concurrencyLimit: 2 },
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 30_000,
    factor: 2,
    randomize: true,
  },
  maxDuration: MAX_WAIT_SECONDS + 300,
  run: async (payload: SceneVideoTaskPayload) => {
    const input = sceneVideoGenerationTaskPayloadSchema.parse(payload);
    const environment = getSceneVideoEnvironment();
    const scope = {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      generationId: input.generationId,
    };

    const generation = await findSceneClipGeneration(scope);
    if (!generation) return { outcome: "missing" as const };
    if (generation.status === "succeeded" || generation.status === "failed")
      return { outcome: "alreadySettled" as const, status: generation.status };

    if (!environment.ENABLE_SCENE_VIDEO_GENERATION) {
      await failSceneClipGeneration({
        ...scope,
        category: "feature_disabled",
        safeErrorMessage: "Scene clip generation is switched off.",
      });
      return { outcome: "failed" as const };
    }

    // The same verification every other generation gets: a published template,
    // unaltered, that this build recognises. See the prompt template registry
    // for why "recognises" is not the same question as "is the newest".
    const promptTemplate = await findPromptTemplateVersion({
      templateKey: "scene-motion",
      version: generation.promptTemplateVersion ?? "",
    });
    const verification = verifyPromptTemplate({
      templateKey: "scene-motion",
      pinnedVersion: generation.promptTemplateVersion,
      pinnedVersionId: generation.promptTemplateVersionId,
      storedTemplate: promptTemplate
        ? {
            id: promptTemplate.id,
            version: promptTemplate.version,
            sourceHash: promptTemplate.sourceHash,
          }
        : null,
    });
    if (verification.outcome !== "verified") {
      await failSceneClipGeneration({
        ...scope,
        category:
          verification.outcome === "unknownVersion"
            ? "prompt_template_unavailable"
            : "prompt_template_mismatch",
        safeErrorMessage:
          verification.outcome === "unknownVersion"
            ? "This clip needs a newer background worker than the one running. Deploy the workers, then generate again."
            : "The versioned motion prompt could not be verified, so no provider request was made.",
      });
      return { outcome: "failed" as const };
    }

    if (!generation.finalPrompt) {
      await failSceneClipGeneration({
        ...scope,
        category: "prompt_missing",
        safeErrorMessage: "This clip has no stored prompt to send.",
      });
      return { outcome: "failed" as const };
    }

    // Claiming is what stops a duplicate dispatch starting a second paid job.
    const claimed = await claimSceneClipRunning(scope);
    if (!claimed) return { outcome: "alreadyClaimed" as const };

    const provider = new OpenAiVideoProvider({
      apiKey: environment.OPENAI_API_KEY,
    });

    try {
      let startImage: { bytes: Uint8Array; mimeType: "image/png" } | undefined;
      if (generation.mode === "image_to_video") {
        if (!generation.sourceImageGenerationId)
          throw new VideoGenerationProviderError({
            code: "missing_start_image",
            retriable: false,
          });
        const still = await findSceneImageGeneration({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          generationId: generation.sourceImageGenerationId,
        });
        if (!still?.assetObjectKey)
          throw new VideoGenerationProviderError({
            code: "start_image_unavailable",
            retriable: false,
          });
        // Bytes, never a signed URL: nothing that grants access to storage is
        // handed to a model provider. The adapter recuts this to the clip's
        // exact canvas before sending it.
        startImage = {
          bytes: await downloadSceneStillBytes({
            objectKey: still.assetObjectKey,
            maximumBytes: MAX_STILL_BYTES,
          }),
          mimeType: "image/png",
        };
      }

      const job = await provider.start({
        modelSlug: generation.model,
        mode:
          generation.mode === "image_to_video" ? "imageToVideo" : "textToVideo",
        prompt: generation.finalPrompt,
        negativePrompt: "",
        aspectRatio: generation.aspectRatio as "16:9" | "9:16" | "1:1",
        durationSeconds: generation.durationSeconds,
        resolutionHeight: generation.resolutionHeight,
        startImage,
        idempotencyKey: generation.idempotencyKey ?? generation.id,
      });

      // Written before the first poll, so a worker that dies here still leaves
      // the job findable rather than orphaned and paid for.
      await recordSceneClipProviderJob({
        ...scope,
        providerJobId: job.providerJobId,
        providerRequestId: job.providerRequestId,
      });

      const deadline = Date.now() + MAX_WAIT_SECONDS * 1000;
      let status = await provider.check(job);
      while (status.state === "running" && Date.now() < deadline) {
        if (status.progressPercent !== null)
          await updateSceneClipProgress({
            ...scope,
            progressPercent: status.progressPercent,
          });
        await wait.for({ seconds: POLL_SECONDS });
        status = await provider.check(job);
      }

      if (status.state === "running") {
        await failSceneClipGeneration({
          ...scope,
          category: "provider_timeout",
          safeErrorMessage:
            "The clip did not finish in time. Nothing was stored; try again.",
        });
        return { outcome: "failed" as const };
      }

      if (status.state === "failed") {
        await failSceneClipGeneration({
          ...scope,
          category: `provider_${status.code}`,
          safeErrorMessage:
            "The video provider could not produce this clip. Try a simpler motion description.",
        });
        return { outcome: "failed" as const };
      }

      const content = await provider.download(job);
      const stored = await putSceneClip({
        objectKey: createSceneClipObjectKey({
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          sceneId: generation.sceneId,
          sceneVersionId: generation.sceneVersionId,
          generationId: generation.id,
          extension: content.mimeType.includes("webm") ? "webm" : "mp4",
        }),
        generationId: generation.id,
        bytes: content.bytes,
        contentType: content.mimeType,
        providerRequestId: job.providerRequestId,
        actualCostCents:
          status.actualCostCents ?? generation.estimatedCostCents,
        durationMilliseconds: status.durationMilliseconds,
        maximumBytes: MAX_CLIP_BYTES,
      });

      await completeSceneClipGeneration({
        ...scope,
        actualCostCents: status.actualCostCents,
        asset: {
          objectKey: stored.objectKey,
          contentType: stored.contentType,
          sizeBytes: stored.sizeBytes,
          etag: stored.etag,
          width: status.width,
          height: status.height,
          durationMilliseconds: status.durationMilliseconds,
        },
      });

      logger.info("Scene clip stored", {
        generationId: generation.id,
        sizeBytes: stored.sizeBytes,
      });
      return { outcome: "succeeded" as const, generationId: generation.id };
    } catch (error) {
      const providerError =
        error instanceof VideoGenerationProviderError ? error : null;
      logger.error("Scene clip generation failed", {
        generationId: generation.id,
        code: providerError?.code ?? "unknown",
      });
      // Settled here rather than rethrown, so the reservation is released. A
      // thrown error would leave the money committed to a job nobody will
      // finish, and the budget would shrink with every failure.
      await failSceneClipGeneration({
        ...scope,
        category: providerError ? `provider_${providerError.code}` : "unknown",
        safeErrorMessage:
          "This clip could not be generated. Nothing was charged for a request that never reached the provider.",
      });
      return { outcome: "failed" as const };
    }
  },
});
