import "server-only";
import { ElevenLabsImageError } from "./errors";
import sharp from "sharp";
import { ElevenLabsUnavailableError, requireElevenLabs } from "./configuration";
import {
  startElevenLabsMedia,
  getElevenLabsMedia,
  ElevenLabsApiError,
} from "./client";
import { withPublicDownload } from "@/lib/mcp/safe-download";
import type {
  ImageGenerationProvider,
  ImageGenerationProviderInput,
  ImageGenerationProviderResult,
} from "@/lib/openai/image-generation-provider";

export { ElevenLabsImageError } from "./errors";
export class ElevenLabsImageProvider implements ImageGenerationProvider {
  constructor(
    private readonly onAccepted: (id: string) => Promise<void>,
    private readonly pause = () =>
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    private readonly resumeJobId?: string,
  ) {}
  async generate(
    input: ImageGenerationProviderInput,
  ): Promise<ImageGenerationProviderResult> {
    requireElevenLabs(true);
    if (
      input.model !== "elevenlabs/gpt-image-1.5" ||
      input.references.length > 5 ||
      input.references.some((r) => r.bytes.byteLength > 25 * 1024 * 1024)
    )
      throw new ElevenLabsImageError(
        null,
        true,
        "ElevenLabs GPT Image 1.5 accepts up to five image references, each at most 25 MB.",
      );
    let jobId: string | null = this.resumeJobId ?? null;
    try {
      const job = this.resumeJobId
        ? { id: this.resumeJobId }
        : await startElevenLabsMedia("image", {
            model_id: "gpt-image-1.5",
            prompt: input.prompt,
            quality: input.quality,
            background: input.background,
            aspect_ratio:
              input.size === "1536x1024"
                ? "3:2"
                : input.size === "1024x1536"
                  ? "2:3"
                  : "1:1",
            images: input.references.map((r) => ({
              type: "inline_base64",
              content_base64: Buffer.from(r.bytes).toString("base64"),
              mime_type: r.mimeType,
            })),
          });
      jobId = job.id;
      if (!this.resumeJobId) await this.onAccepted(job.id);
      const deadline = Date.now() + 360000;
      for (let i = 0; i < 72 && Date.now() < deadline; i++) {
        requireElevenLabs(true);
        const state = await getElevenLabsMedia("image", job.id);
        if (state.status === "failed")
          throw new ElevenLabsImageError(
            job.id,
            true,
            `ElevenLabs image generation failed (${state.failure_reason}). The provider reports no charge.`,
          );
        if (state.status === "completed") {
          if (
            !["image/png", "image/jpeg", "image/webp"].includes(
              state.content_mime_type,
            )
          )
            throw new Error("Unsupported image result.");
          const raw = await withPublicDownload(
            state.content_url,
            async (response) => {
              if ((response.contentLength ?? 0) > 32 * 1024 * 1024)
                throw new Error("Image result exceeds the limit.");
              const chunks: Uint8Array[] = [];
              let size = 0;
              for await (const chunk of response.body) {
                size += chunk.length;
                if (size > 32 * 1024 * 1024)
                  throw new Error("Image result exceeds the limit.");
                chunks.push(chunk);
              }
              return Buffer.concat(chunks, size);
            },
          );
          const decoded = sharp(raw, { limitInputPixels: 40000000 });
          await decoded.stats();
          const output = await decoded
            .toFormat(input.outputFormat, { quality: input.outputCompression })
            .toBuffer({ resolveWithObject: true });
          return {
            provider: "elevenlabs",
            operation: input.references.length ? "edit" : "generate",
            model: input.model,
            requestId: job.id,
            bytes: output.data,
            mimeType:
              input.outputFormat === "jpeg"
                ? "image/jpeg"
                : input.outputFormat === "webp"
                  ? "image/webp"
                  : "image/png",
            width: output.info.width,
            height: output.info.height,
            usage: null,
            safeMetadata: {
              createdAtEpochSeconds: Math.floor(Date.now() / 1000),
              outputFormat: input.outputFormat,
              quality: input.quality,
              size: input.size,
              referenceCount: input.references.length,
            },
          };
        }
        await this.pause();
      }
      throw new ElevenLabsImageError(
        job.id,
        false,
        "The ElevenLabs image is still processing. Its job ID is preserved; do not submit another paid request.",
      );
    } catch (error) {
      if (error instanceof ElevenLabsImageError) throw error;
      const unbilled =
        jobId === null &&
        (error instanceof ElevenLabsUnavailableError ||
          (error instanceof ElevenLabsApiError &&
            error.status !== null &&
            [400, 401, 402, 403, 404, 422, 429].includes(error.status)));
      throw new ElevenLabsImageError(
        jobId,
        unbilled,
        "ElevenLabs image generation could not be confirmed. The existing operation retains its provider job ID when available.",
      );
    }
  }
}
