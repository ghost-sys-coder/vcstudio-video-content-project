import {
  videoGenerationRequestSchema,
  videoGenerationStartSchema,
  sceneVisualSelectionSchema,
} from "@studio/contracts/video";
import { planVideoGeneration } from "@/lib/video-generation/plan-video-generation";
import {
  VIDEO_MODELS,
  VIDEO_PRICES,
} from "@/lib/video-generation/video-model-catalog";
import type { VideoGenerationView } from "@/lib/video-generation/video-generation-view";
import type { SceneVideoView } from "@/lib/video-generation/scene-video-service";
import { videoVersion, videoClipAsset, videoImageAsset } from "./video-data";
const jobs: VideoGenerationView[] = [];
const keys = new Map<string, string>();
let scene: SceneVideoView = {
  projectDefault: "image",
  sceneVersionId: videoVersion,
  sceneVersion: 1,
  selection: null,
};
const delay = () => new Promise<void>((resolve) => setTimeout(resolve, 350));
export async function quoteVideoAction(_workspace: unknown, value: unknown) {
  await delay();
  const request = videoGenerationRequestSchema.parse(value),
    model = VIDEO_MODELS.find((model) => model.id === request.modelId)!;
  const plan = planVideoGeneration({
    request,
    model,
    pricing: VIDEO_PRICES.find((price) => price.modelId === model.id) ?? null,
  });
  localStorage.setItem("videoQuoted", "true");
  return {
    ok: true as const,
    value: {
      token: "test-only-quote-token",
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      maximumCostCents: plan.estimatedCostCents,
      durationControl: plan.durationControl,
      reservationDurationSeconds: plan.reservationDurationSeconds,
    },
  };
}
export async function startVideoAction(_workspace: unknown, value: unknown) {
  await delay();
  const input = videoGenerationStartSchema.parse(value);
  const existing = keys.get(input.idempotencyKey);
  if (existing)
    return { ok: true as const, value: { id: existing, dispatched: true } };
  const id = crypto.randomUUID();
  keys.set(input.idempotencyKey, id);
  const request = input.request;
  const model = VIDEO_MODELS.find((model) => model.id === request.modelId)!;
  jobs.unshift({
    id,
    title: request.title,
    prompt: request.prompt,
    model: model.name,
    modelId: model.id,
    status: "queued",
    aspectRatio: request.aspectRatio,
    resolution: request.resolution,
    durationSeconds: request.durationSeconds,
    audio: request.audio,
    target: request.target,
    targetDetached: false,
    estimatedCostCents: 60,
    actualCostCents: null,
    outputAssetId: null,
    errorCode: null,
    safeErrorMessage: null,
    canResume: true,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem("videoStarted", String(jobs.length));
  return { ok: true as const, value: { id, dispatched: true } };
}
export async function videoHistoryAction() {
  await delay();
  return { ok: true as const, value: { items: [...jobs], nextCursor: null } };
}
export async function videoResultAction(_workspace: unknown, id: unknown) {
  const job = jobs.find((job) => job.id === id);
  return job
    ? { ok: true as const, value: { job, url: null } }
    : { ok: false as const, error: "Not found" };
}
export async function resumeVideoAction() {
  await delay();
  return { ok: true as const, value: { id: "existing", dispatched: true } };
}
export async function cancelVideoAction(_workspace: unknown, id: unknown) {
  await delay();
  const index = jobs.findIndex((job) => job.id === id);
  if (index >= 0)
    jobs[index] = {
      ...jobs[index]!,
      status: "cancelled",
      canResume: false,
      actualCostCents: 0,
    };
  return { ok: true as const, value: { id } };
}
export async function sceneVideoViewAction() {
  await delay();
  return { ok: true as const, value: scene };
}
export async function saveSceneVideoAction(
  _workspace: unknown,
  value: unknown,
) {
  await delay();
  const input = sceneVisualSelectionSchema.parse(value);
  scene = {
    ...scene,
    selection: {
      id: crypto.randomUUID(),
      kind: input.kind,
      sourceAssetId: input.assetId,
      width: input.kind === "video" ? 640 : null,
      height: input.kind === "video" ? 360 : null,
      durationMilliseconds: input.kind === "video" ? 6000 : null,
      fit: input.fit,
      trimStartMilliseconds: input.trimStartMilliseconds,
      loop: input.loop,
      reviewStatus: "pending",
      revision: (scene.selection?.revision ?? 0) + 1,
    },
  };
  return { ok: true as const, value: scene };
}
export async function reviewSceneVideoAction(
  _workspace: unknown,
  value: { reviewStatus: "approved" | "rejected" },
) {
  await delay();
  if (scene.selection)
    scene = {
      ...scene,
      selection: {
        ...scene.selection,
        reviewStatus: value.reviewStatus,
        revision: scene.selection.revision + 1,
      },
    };
  return { ok: true as const, value: scene };
}
export async function previewSceneVideoAction() {
  return {
    ok: false as const,
    error: "Source playback is separately verified with a media fixture.",
  };
}
export async function projectVisualDefaultAction() {
  await delay();
  return { ok: true as const, value: { updatedAt: new Date().toISOString() } };
}
export async function getMediaLibraryPageAction(input: {
  kind?: "image" | "video";
}) {
  localStorage.setItem("videoLibraryOpened", "true");
  await delay();
  return {
    ok: true as const,
    view: {
      assets: input.kind === "video" ? [videoClipAsset] : [videoImageAsset],
      pageSize: 24,
      kind: input.kind ?? null,
      nextCursor: null,
    },
  };
}

export async function sceneStarterImageAction() {
  return {
    ok: true as const,
    value: {
      assetId: videoImageAsset.id,
      sceneVersionId: videoVersion,
      title: "Scene 1 approved image",
    },
  };
}
