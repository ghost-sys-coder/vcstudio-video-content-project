import "server-only";

import OpenAI, { toFile } from "openai";
import {
  getOpenAiVideoDimensions,
  toOpenAiVideoSeconds,
  toOpenAiVideoSize,
  toVideoGenerationStatus,
} from "@/lib/video-models/openai-video-mapping";
import { prepareStartFrame } from "@/lib/video-models/prepare-start-frame";
import {
  VideoGenerationProviderError,
  type VideoGenerationJob,
  type VideoGenerationProvider,
  type VideoGenerationRequest,
  type VideoGenerationStatus,
} from "@/lib/video-models/video-generation-provider";

/**
 * Reaches OpenAI's video models through the gateway.
 *
 * **Why the adapter is this thin.** Everything that required a decision — which
 * length to buy, which shape, how many times it repeats, what it costs, whether
 * to spend at all — was decided upstream by the planner. What is left is
 * translation: the API wants its length as a string, its size as `WxH`, and its
 * starting image at exactly the size of the clip. That last one is the only
 * part with any substance, and it is why an approved still is recut here.
 *
 * **What this deliberately does not do.** It does not retry. The worker owns
 * retry policy for everything billable, and an adapter that quietly tried again
 * would spend money the budget check never saw. It also passes no negative
 * prompt, because the API has no such field; those constraints are written into
 * the motion prompt itself instead.
 */
export class OpenAiVideoProvider implements VideoGenerationProvider {
  readonly providerKey = "openai";
  private readonly client: OpenAI;

  constructor(input: {
    apiKey?: string;
    client?: OpenAI;
    timeoutMilliseconds?: number;
  }) {
    this.client =
      input.client ??
      new OpenAI({
        apiKey: input.apiKey,
        timeout: input.timeoutMilliseconds ?? 120_000,
        // The worker decides when to try again; see above.
        maxRetries: 0,
      });
  }

  async start(request: VideoGenerationRequest): Promise<VideoGenerationJob> {
    const size = toOpenAiVideoSize(request.aspectRatio);
    if (!size)
      throw new VideoGenerationProviderError({
        code: "unsupported_aspect_ratio",
        retriable: false,
      });

    const seconds = toOpenAiVideoSeconds(request.durationSeconds);
    if (!seconds)
      throw new VideoGenerationProviderError({
        code: "unsupported_duration",
        retriable: false,
      });

    if (request.mode === "imageToVideo" && !request.startImage)
      throw new VideoGenerationProviderError({
        code: "missing_start_image",
        retriable: false,
      });

    // The API accepts a starting image only at the clip's own size, so an
    // approved still has to be recut before it can be animated.
    const startFrame = request.startImage
      ? await prepareStartFrame({
          bytes: request.startImage.bytes,
          targetWidth: getOpenAiVideoDimensions(size).width,
          targetHeight: getOpenAiVideoDimensions(size).height,
        })
      : null;

    try {
      const video = await this.client.videos.create({
        model: request.modelSlug,
        prompt: request.prompt,
        seconds,
        size,
        ...(startFrame
          ? {
              input_reference: await toFile(
                Buffer.from(startFrame.bytes),
                "start-frame.png",
                { type: startFrame.mimeType },
              ),
            }
          : {}),
      });
      return { providerJobId: video.id, providerRequestId: video.id };
    } catch (error) {
      throw toProviderError(error);
    }
  }

  async check(job: VideoGenerationJob): Promise<VideoGenerationStatus> {
    try {
      const video = await this.client.videos.retrieve(job.providerJobId);
      const [width, height] = video.size.split("x").map(Number);
      return toVideoGenerationStatus({
        status: video.status,
        progress: typeof video.progress === "number" ? video.progress : null,
        errorCode: video.error?.code ?? null,
        mimeType: "video/mp4",
        durationSeconds: Number(video.seconds) || null,
        width: Number.isFinite(width) ? width : null,
        height: Number.isFinite(height) ? height : null,
        // The API reports no per-job charge, so the estimate stands as the
        // recorded cost rather than a guess dressed up as a measurement.
        actualCostCents: null,
      });
    } catch (error) {
      throw toProviderError(error);
    }
  }

  async download(
    job: VideoGenerationJob,
  ): Promise<{ bytes: Uint8Array; mimeType: string }> {
    try {
      const response = await this.client.videos.downloadContent(
        job.providerJobId,
      );
      const buffer = await response.arrayBuffer();
      return {
        bytes: new Uint8Array(buffer),
        mimeType: response.headers.get("content-type") ?? "video/mp4",
      };
    } catch (error) {
      throw toProviderError(error);
    }
  }
}

/**
 * Turns an SDK failure into the gateway's own error.
 *
 * Only the transient classes are retriable. Everything else, including anything
 * unrecognised, is permanent: trying a billable request again on a guess is how
 * one refusal becomes a repeated charge.
 */
function toProviderError(error: unknown): VideoGenerationProviderError {
  if (error instanceof VideoGenerationProviderError) return error;
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 0;
    return new VideoGenerationProviderError({
      code: error.code ?? `http_${status}`,
      retriable: status === 429 || status >= 500,
      providerRequestId: error.requestID ?? null,
    });
  }
  return new VideoGenerationProviderError({
    code: "video_provider_unavailable",
    // A transport failure never reached the model, so nothing was charged.
    retriable: true,
  });
}
