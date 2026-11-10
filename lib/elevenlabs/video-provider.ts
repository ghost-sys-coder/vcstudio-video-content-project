import "server-only";
import { requireElevenLabs, ElevenLabsUnavailableError } from "./configuration";
import {
  startElevenLabsMedia,
  getElevenLabsMedia,
  ElevenLabsApiError,
} from "./client";
import { downloadPublicVideo } from "@/lib/video-generation/providers/download-public-video";
import {
  VideoProviderError,
  type VideoProvider,
  type VideoProviderState,
} from "@/lib/video-generation/video-provider";

export class ElevenLabsVideoProvider implements VideoProvider {
  async start(
    input: Parameters<VideoProvider["start"]>[0],
  ): Promise<VideoProviderState> {
    requireElevenLabs(true);
    const { request, assets } = input;
    const reference = (asset: (typeof assets)[number]) => ({
      type: "inline_base64",
      content_base64: asset.bytes.toString("base64"),
      mime_type: asset.contentType,
    });
    try {
      const first = assets.find((a) => a.role === "first_frame"),
        last = assets.find((a) => a.role === "last_frame");
      const job = await startElevenLabsMedia("video", {
        model_id: input.model.providerModelId,
        prompt: input.finalPrompt,
        negative_prompt: request.negativePrompt || undefined,
        seed: request.seed ?? undefined,
        enhance_prompt: false,
        duration_secs: request.durationSeconds,
        aspect_ratio: request.aspectRatio,
        resolution: request.resolution === "4k" ? "4K" : request.resolution,
        generate_audio: request.audio === "native",
        start_frame: first ? reference(first) : undefined,
        end_frame: last ? reference(last) : undefined,
        images:
          request.mode === "reference_to_video"
            ? assets.map((a) => ({
                image: reference(a),
                role: a.role === "style" ? "style" : "subject",
              }))
            : undefined,
      });
      return { status: "running", jobId: job.id, requestId: job.id };
    } catch (e) {
      throw new VideoProviderError(
        e instanceof ElevenLabsApiError && e.status === 402
          ? "elevenlabs_pro_required"
          : "elevenlabs_submission_failed",
        e instanceof ElevenLabsUnavailableError ||
          (e instanceof ElevenLabsApiError &&
            e.status !== null &&
            [400, 401, 402, 403, 404, 422, 429].includes(e.status)),
      );
    }
  }
  async check(jobId: string): Promise<VideoProviderState> {
    requireElevenLabs(true);
    const state = await getElevenLabsMedia("video", jobId);
    if (state.status === "completed") {
      if (state.content_mime_type !== "video/mp4")
        throw new VideoProviderError(
          "elevenlabs_invalid_video_type",
          false,
          jobId,
        );
      return {
        status: "succeeded",
        jobId,
        requestId: jobId,
        output: { kind: "uri", uri: state.content_url },
        usage: null,
      };
    }
    if (state.status === "failed")
      return {
        status: "failed",
        jobId,
        requestId: jobId,
        code: `elevenlabs_${state.failure_reason}`,
        safeMessage: "ElevenLabs reports a failed, uncharged generation.",
        definitelyUnbilled: true,
      };
    return { status: "running", jobId, requestId: jobId };
  }
  download(uri: string) {
    requireElevenLabs(true);
    return downloadPublicVideo(uri);
  }
}
