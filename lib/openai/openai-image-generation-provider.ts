import "server-only";

import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import type { ImageGenerationUsage } from "@/lib/costs/scene-image-cost";
import {
  ImageGenerationProviderResponseError,
  type ImageGenerationProvider,
  type ImageGenerationProviderInput,
  type ImageGenerationProviderResult,
  type ImageReferenceMimeType,
} from "@/lib/openai/image-generation-provider";
import {
  prepareOpenAiImageRequest,
  type PreparedOpenAiImageRequest,
} from "@/lib/openai/image-generation-request";
import { getSceneImageDimensions } from "@/lib/schemas/scene-image";

const extensionByMimeType: Record<ImageReferenceMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const mimeTypeByOutputFormat = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
} as const satisfies Record<string, ImageReferenceMimeType>;

function mapUsage(
  usage: OpenAI.ImagesResponse["usage"],
): ImageGenerationUsage | null {
  if (!usage) return null;
  return {
    inputTextTokens: usage.input_tokens_details.text_tokens,
    inputImageTokens: usage.input_tokens_details.image_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
  };
}

function invalidResponse(input: {
  code: string;
  requestId: string | null;
  usage: ImageGenerationUsage | null;
}): ImageGenerationProviderResponseError {
  return new ImageGenerationProviderResponseError(input);
}

async function createReferenceFiles(
  prepared: PreparedOpenAiImageRequest,
): Promise<File[]> {
  return Promise.all(
    prepared.references.map((reference, index) =>
      toFile(
        reference.bytes,
        `reference-${index + 1}.${extensionByMimeType[reference.mimeType]}`,
        { type: reference.mimeType },
      ),
    ),
  );
}

export class OpenAiImageGenerationProvider implements ImageGenerationProvider {
  private readonly client: OpenAI;

  constructor(input: {
    apiKey: string;
    timeoutMilliseconds?: number;
    client?: OpenAI;
  }) {
    if (input.apiKey.trim().length === 0)
      throw new RangeError("An OpenAI API key is required.");
    if (
      input.timeoutMilliseconds !== undefined &&
      (!Number.isFinite(input.timeoutMilliseconds) ||
        input.timeoutMilliseconds <= 0)
    )
      throw new RangeError("OpenAI timeout must be a positive number.");

    this.client =
      input.client ??
      new OpenAI({
        apiKey: input.apiKey,
        timeout: input.timeoutMilliseconds ?? 180_000,
        maxRetries: 0,
      });
  }

  async generate(
    input: ImageGenerationProviderInput,
  ): Promise<ImageGenerationProviderResult> {
    const prepared = prepareOpenAiImageRequest(input);
    const baseParameters = {
      model: prepared.model,
      prompt: prepared.prompt,
      n: 1,
      quality: prepared.quality,
      size: prepared.size,
      output_format: prepared.outputFormat,
      ...(prepared.outputCompression === undefined
        ? {}
        : { output_compression: prepared.outputCompression }),
      background: prepared.background,
      stream: false as const,
      ...(prepared.endUserId ? { user: prepared.endUserId } : {}),
    };

    const response =
      prepared.operation === "generate"
        ? await this.client.images
            .generate({ ...baseParameters, moderation: "auto" })
            .withResponse()
        : await this.client.images
            .edit({
              ...baseParameters,
              image: await createReferenceFiles(prepared),
              ...(prepared.inputFidelity
                ? { input_fidelity: prepared.inputFidelity }
                : {}),
            })
            .withResponse();

    const usage = mapUsage(response.data.usage);
    const encodedImage = response.data.data?.[0]?.b64_json;
    if (!encodedImage)
      throw invalidResponse({
        code: "OPENAI_IMAGE_DATA_MISSING",
        requestId: response.request_id,
        usage,
      });

    const bytes = Buffer.from(encodedImage, "base64");
    if (bytes.byteLength === 0)
      throw invalidResponse({
        code: "OPENAI_IMAGE_DATA_INVALID",
        requestId: response.request_id,
        usage,
      });

    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(bytes, { failOn: "error" }).metadata();
    } catch {
      throw invalidResponse({
        code: "OPENAI_IMAGE_DATA_INVALID",
        requestId: response.request_id,
        usage,
      });
    }

    const expectedDimensions = getSceneImageDimensions(prepared.size);
    if (
      metadata.width !== expectedDimensions.width ||
      metadata.height !== expectedDimensions.height ||
      metadata.format !== prepared.outputFormat ||
      (response.data.output_format !== undefined &&
        response.data.output_format !== prepared.outputFormat) ||
      (response.data.quality !== undefined &&
        response.data.quality !== prepared.quality) ||
      (response.data.size !== undefined && response.data.size !== prepared.size)
    )
      throw invalidResponse({
        code: "OPENAI_IMAGE_METADATA_MISMATCH",
        requestId: response.request_id,
        usage,
      });

    return {
      provider: "openai",
      operation: prepared.operation,
      model: prepared.model,
      requestId: response.request_id,
      bytes,
      mimeType: mimeTypeByOutputFormat[prepared.outputFormat],
      width: expectedDimensions.width,
      height: expectedDimensions.height,
      usage,
      safeMetadata: {
        createdAtEpochSeconds: response.data.created,
        outputFormat: response.data.output_format ?? prepared.outputFormat,
        quality: response.data.quality ?? prepared.quality,
        size: response.data.size ?? prepared.size,
        referenceCount: prepared.references.length,
      },
    };
  }
}
