import "server-only";
import { z } from "zod";
import {
  VideoProviderError,
  type VideoProvider,
  type VideoProviderState,
} from "../video-provider";
import { providerJson } from "./provider-http";
import { downloadPublicVideo } from "./download-public-video";
const BASE = "https://agents.lumalabs.ai/v1/generations";
const generationSchema = z.object({
  id: z.uuid(),
  state: z.enum(["queued", "dreaming", "processing", "completed", "failed"]),
  output: z.array(z.object({ type: z.string(), url: z.url() })).optional(),
  usage: z
    .object({ credits_charged: z.number().int().nonnegative().nullable() })
    .nullable()
    .optional(),
});
/** Ray 3.2 SDR generation. No legacy Dream Machine endpoints or unverified controls. */
export class LumaVideoProvider implements VideoProvider {
  constructor(
    private readonly key: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  private headers() {
    return {
      Authorization: `Bearer ${this.key}`,
      "Content-Type": "application/json",
    };
  }
  private state(value: unknown): VideoProviderState {
    const parsed = generationSchema.safeParse(value);
    if (!parsed.success)
      throw new VideoProviderError("provider_invalid_response", false);
    const data = parsed.data;
    if (data.state === "failed")
      return {
        status: "failed",
        jobId: data.id,
        requestId: data.id,
        code: "luma_generation_failed",
        safeMessage:
          "Luma could not complete this video. Review its charge before starting another.",
      };
    if (data.state !== "completed")
      return { status: "running", jobId: data.id, requestId: data.id };
    const video = data.output?.find((item) => item.type === "video");
    if (!video)
      throw new VideoProviderError("provider_missing_video", false, data.id);
    const credits = data.usage?.credits_charged;
    return {
      status: "succeeded",
      jobId: data.id,
      requestId: data.id,
      output: { kind: "uri", uri: video.url },
      usage:
        typeof credits === "number"
          ? {
              inputTokens: 0,
              outputTokens: 0,
              videoTokens: 0,
              thoughtTokens: 0,
              creditsCharged: credits,
            }
          : null,
    };
  }
  async start(input: Parameters<VideoProvider["start"]>[0]) {
    const frame = (role: string) => {
      const asset = input.assets.find((item) => item.role === role);
      return asset
        ? {
            data: asset.bytes.toString("base64"),
            media_type: asset.contentType,
          }
        : undefined;
    };
    return this.state(
      await providerJson(this.fetcher, BASE, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: input.model.providerModelId,
          type: "video",
          prompt: input.finalPrompt,
          aspect_ratio: input.request.aspectRatio,
          video: {
            resolution: input.request.resolution,
            duration: `${input.request.durationSeconds}s`,
            start_frame: frame("first_frame"),
            end_frame: frame("last_frame"),
          },
        }),
      }),
    );
  }
  async check(jobId: string) {
    if (!z.uuid().safeParse(jobId).success)
      throw new VideoProviderError("provider_invalid_handle", false);
    return this.state(
      await providerJson(this.fetcher, `${BASE}/${encodeURIComponent(jobId)}`, {
        headers: this.headers(),
      }),
    );
  }
  download(uri: string) {
    return downloadPublicVideo(uri);
  }
}
