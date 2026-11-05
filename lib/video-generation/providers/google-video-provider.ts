import "server-only";
import { z } from "zod";
import type { VideoProvider, VideoProviderState } from "../video-provider";
import { VideoProviderError } from "../video-provider";
import { orderedVideoInputs } from "../video-input-order";
import {
  boundedResponseBytes,
  MAX_VIDEO_BYTES,
  providerJson,
} from "./provider-http";

const contentSchema = z.object({
  type: z.string(),
  mime_type: z.string().optional(),
  data: z.string().optional(),
  uri: z.string().optional(),
});
const interactionSchema = z.object({
  id: z.string().min(1).max(500),
  status: z.string(),
  steps: z
    .array(
      z.object({
        type: z.string(),
        content: z.array(contentSchema).optional(),
      }),
    )
    .optional(),
  usage: z
    .object({
      total_input_tokens: z.number().int().nonnegative().optional(),
      total_output_tokens: z.number().int().nonnegative().optional(),
      total_thought_tokens: z.number().int().nonnegative().optional(),
      output_tokens_by_modality: z
        .array(
          z.object({
            modality: z.string(),
            tokens: z.number().int().nonnegative(),
          }),
        )
        .optional(),
    })
    .optional(),
});
const BASE = "https://generativelanguage.googleapis.com/v1beta";
/** Only fixed Google endpoints receive the API key. Never follow authenticated redirects. */
export class GoogleVideoProvider implements VideoProvider {
  constructor(
    private readonly key: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}
  private headers() {
    return { "x-goog-api-key": this.key, "Content-Type": "application/json" };
  }
  private state(value: unknown): VideoProviderState {
    const parsed = interactionSchema.safeParse(value);
    if (!parsed.success)
      throw new VideoProviderError("provider_invalid_response", false);
    const data = parsed.data;
    if (
      [
        "failed",
        "cancelled",
        "incomplete",
        "requires_action",
        "requires_continuation",
      ].includes(data.status)
    )
      return {
        status: "failed",
        jobId: data.id,
        requestId: data.id,
        code: "google_generation_failed",
        safeMessage:
          "Google could not complete this video. Review the existing operation before retrying.",
      };
    if (data.status !== "completed")
      return { status: "running", jobId: data.id, requestId: data.id };
    const video = data.steps
      ?.filter((step) => step.type === "model_output")
      .flatMap((step) => step.content ?? [])
      .find((content) => content.type === "video");
    if (!video || video.mime_type !== "video/mp4")
      throw new VideoProviderError("provider_missing_video", false, data.id);
    const usage = data.usage
      ? {
          inputTokens: data.usage.total_input_tokens ?? 0,
          outputTokens: data.usage.total_output_tokens ?? 0,
          thoughtTokens: data.usage.total_thought_tokens ?? 0,
          unknownOutputTokens:
            data.usage.output_tokens_by_modality
              ?.filter(
                (item) =>
                  !["video", "text"].includes(item.modality.toLowerCase()),
              )
              .reduce((sum, item) => sum + item.tokens, 0) ?? 0,
          videoTokens:
            data.usage.output_tokens_by_modality
              ?.filter((item) => item.modality.toLowerCase() === "video")
              .reduce((sum, item) => sum + item.tokens, 0) ?? 0,
        }
      : null;
    if (video.uri)
      return {
        status: "succeeded",
        jobId: data.id,
        requestId: data.id,
        output: { kind: "uri", uri: this.fileUri(video.uri) },
        usage,
      };
    if (
      !video.data ||
      video.data.length > Math.ceil((MAX_VIDEO_BYTES * 4) / 3) ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(video.data)
    )
      throw new VideoProviderError("provider_invalid_video", false, data.id);
    return {
      status: "succeeded",
      jobId: data.id,
      requestId: data.id,
      output: { kind: "inline", bytes: Buffer.from(video.data, "base64") },
      usage,
    };
  }
  private fileUri(value: string) {
    const url = new URL(
      value.startsWith("files/")
        ? `${BASE}/${value}:download?alt=media`
        : value,
    );
    if (
      url.origin !== "https://generativelanguage.googleapis.com" ||
      !/^\/v1beta\/files\/[A-Za-z0-9_-]+(?::download)?$/.test(url.pathname) ||
      url.username ||
      url.password
    )
      throw new VideoProviderError("provider_unsafe_output", false);
    // Only the file identifier is trusted; drop supplied query credentials.
    return `${BASE}/files/${url.pathname.split("/").at(-1)?.replace(":download", "")}:download?alt=media`;
  }
  async start(input: Parameters<VideoProvider["start"]>[0]) {
    const parts = orderedVideoInputs(input.request.mode, input.assets).flatMap(
      (asset) => [
        {
          type: "image",
          mime_type: asset.contentType,
          data: asset.bytes.toString("base64"),
        },
      ],
    );
    return this.state(
      await providerJson(this.fetcher, `${BASE}/interactions`, {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({
          model: input.model.providerModelId,
          input: [...parts, { type: "text", text: input.finalPrompt }],
          background: true,
          store: true,
          stream: false,
          generation_config: { video_config: { task: input.request.mode } },
          response_format: {
            type: "video",
            delivery: "uri",
            aspect_ratio: input.request.aspectRatio,
            resolution: input.request.resolution,
          },
        }),
      }),
    );
  }
  async check(jobId: string) {
    return this.state(
      await providerJson(
        this.fetcher,
        `${BASE}/interactions/${encodeURIComponent(jobId)}`,
        { headers: this.headers() },
      ),
    );
  }
  async download(uri: string) {
    const safe = this.fileUri(uri);
    const metadata = await providerJson(
      this.fetcher,
      safe.replace(":download?alt=media", ""),
      { headers: this.headers() },
    );
    const file = z.object({ state: z.string() }).parse(metadata);
    if (file.state !== "ACTIVE")
      throw new VideoProviderError(
        file.state === "FAILED" ? "google_file_failed" : "google_file_pending",
        false,
      );
    const response = await this.fetcher(safe, {
      headers: this.headers(),
      redirect: "error",
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok)
      throw new VideoProviderError("provider_download_failed", false);
    return boundedResponseBytes(response, MAX_VIDEO_BYTES);
  }
}
