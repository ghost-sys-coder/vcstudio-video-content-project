import "server-only";
import { z } from "zod";
import type { VideoProvider, VideoProviderState } from "../video-provider";
import { VideoProviderError } from "../video-provider";
import { providerJson } from "./provider-http";
import { downloadPublicVideo } from "./download-public-video";
const BASE = "https://api.dev.runwayml.com/v1";
const taskSchema = z.object({
  id: z.string().min(1).max(500),
  status: z.string().optional(),
  output: z.array(z.url()).optional(),
});
/** Runway's own models only; partner routes need their own verified capabilities. */
export class RunwayVideoProvider implements VideoProvider {
  constructor(
    private readonly key: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  private headers() {
    return {
      Authorization: `Bearer ${this.key}`,
      "X-Runway-Version": "2024-11-06",
      "Content-Type": "application/json",
    };
  }
  private state(value: unknown): VideoProviderState {
    const parsed = taskSchema.safeParse(value);
    if (!parsed.success)
      throw new VideoProviderError("provider_invalid_response", false);
    const data = parsed.data;
    if (["FAILED", "CANCELLED"].includes(data.status ?? ""))
      return {
        status: "failed",
        jobId: data.id,
        requestId: data.id,
        code: "runway_generation_failed",
        safeMessage:
          "Runway could not complete the video. Review this operation before starting a new one.",
      };
    if (data.status !== "SUCCEEDED")
      return { status: "running", jobId: data.id, requestId: data.id };
    if (!data.output?.[0])
      throw new VideoProviderError("provider_missing_video", false, data.id);
    return {
      status: "succeeded",
      jobId: data.id,
      requestId: data.id,
      output: { kind: "uri", uri: data.output[0] },
      usage: null,
    };
  }
  async start(input: Parameters<VideoProvider["start"]>[0]) {
    const output = input.model.outputs.find(
      (output) =>
        output.aspectRatio === input.request.aspectRatio &&
        output.resolution === input.request.resolution,
    );
    if (!output) throw new VideoProviderError("unsupported_output", true);
    const first = input.assets.find((asset) => asset.role === "first_frame");
    return this.state(
      await providerJson(
        this.fetcher,
        `${BASE}/${first ? "image_to_video" : "text_to_video"}`,
        {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify({
            model: input.model.providerModelId,
            promptText: input.finalPrompt,
            ratio: `${output.width}:${output.height}`,
            duration: input.request.durationSeconds,
            ...(input.request.seed !== null
              ? { seed: input.request.seed }
              : {}),
            ...(first
              ? {
                  promptImage: `data:${first.contentType};base64,${first.bytes.toString("base64")}`,
                }
              : {}),
          }),
        },
      ),
    );
  }
  async check(jobId: string) {
    return this.state(
      await providerJson(
        this.fetcher,
        `${BASE}/tasks/${encodeURIComponent(jobId)}`,
        { headers: this.headers() },
      ),
    );
  }
  async cancel(jobId: string) {
    const response = await this.fetcher(
      `${BASE}/tasks/${encodeURIComponent(jobId)}`,
      {
        method: "DELETE",
        headers: this.headers(),
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      },
    );
    await response.body?.cancel();
    if (!response.ok)
      throw new VideoProviderError("provider_cancel_failed", false);
  }
  async download(uri: string) {
    return downloadPublicVideo(uri);
  }
}
