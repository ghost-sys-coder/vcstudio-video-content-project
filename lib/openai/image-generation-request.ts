import {
  IMAGE_REFERENCE_MIME_TYPES,
  type ImageGenerationProviderInput,
  type ImageGenerationReference,
} from "@/lib/openai/image-generation-provider";
import { sceneImageProviderConfigurationSchema } from "@/lib/schemas/scene-image";

export const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_OPENAI_IMAGE_OUTPUT_FORMAT = "webp";
export const DEFAULT_OPENAI_IMAGE_DRAFT_QUALITY = "low";
export const DEFAULT_OPENAI_IMAGE_FINAL_QUALITY = "medium";
export const DEFAULT_OPENAI_IMAGE_DRAFT_COMPRESSION = 80;
export const DEFAULT_OPENAI_IMAGE_FINAL_COMPRESSION = 90;

export const OPENAI_MAX_REFERENCE_ASSETS = 16;
export const OPENAI_MAX_REFERENCE_SIZE_BYTES = 50 * 1024 * 1024;

export type PreparedOpenAiImageRequest = {
  operation: "generate" | "edit";
  model: string;
  prompt: string;
  quality: "low" | "medium" | "high";
  size: "1536x1024" | "1024x1536" | "1024x1024";
  outputFormat: "webp" | "png" | "jpeg";
  outputCompression?: number;
  background: "opaque" | "auto";
  endUserId?: string;
  inputFidelity?: "high";
  references: ImageGenerationReference[];
};

function supportsConfigurableHighInputFidelity(model: string): boolean {
  if (model === "gpt-image-1") return true;
  if (model === "chatgpt-image-latest") return true;
  return model === "gpt-image-1.5" || model.startsWith("gpt-image-1.5-");
}

export type OpenAiReferenceInputFidelitySnapshot =
  "high" | "automatic_high" | null;

export function getOpenAiReferenceInputFidelitySnapshot(input: {
  model: string;
  hasReferences: boolean;
}): OpenAiReferenceInputFidelitySnapshot {
  if (!input.hasReferences) return null;
  if (supportsConfigurableHighInputFidelity(input.model)) return "high";
  if (input.model === "gpt-image-2" || input.model.startsWith("gpt-image-2-"))
    return "automatic_high";
  return null;
}

function validateReferences(references: ImageGenerationReference[]): void {
  if (references.length > OPENAI_MAX_REFERENCE_ASSETS)
    throw new RangeError(
      `A generation can include at most ${OPENAI_MAX_REFERENCE_ASSETS} reference assets.`,
    );
  if (
    new Set(references.map(({ assetId }) => assetId)).size !== references.length
  )
    throw new RangeError("Reference asset identifiers must be unique.");

  for (const reference of references) {
    if (reference.assetId.trim().length === 0)
      throw new RangeError("Reference asset identifiers cannot be empty.");
    if (!IMAGE_REFERENCE_MIME_TYPES.includes(reference.mimeType))
      throw new RangeError("A reference asset has an unsupported image type.");
    if (
      reference.bytes.byteLength === 0 ||
      reference.bytes.byteLength >= OPENAI_MAX_REFERENCE_SIZE_BYTES
    )
      throw new RangeError(
        "Each OpenAI reference asset must be non-empty and smaller than 50 MB.",
      );
  }
}

export function prepareOpenAiImageRequest(
  input: ImageGenerationProviderInput,
): PreparedOpenAiImageRequest {
  const configuration = sceneImageProviderConfigurationSchema.parse(input);
  validateReferences(input.references);
  const references = [...input.references].sort((left, right) =>
    left.assetId.localeCompare(right.assetId),
  );
  const operation = references.length === 0 ? "generate" : "edit";
  const inputFidelity = getOpenAiReferenceInputFidelitySnapshot({
    model: configuration.model,
    hasReferences: operation === "edit",
  });

  return {
    operation,
    model: configuration.model,
    prompt: configuration.prompt,
    quality: configuration.quality,
    size: configuration.size,
    outputFormat: configuration.outputFormat,
    ...(configuration.outputFormat === "png"
      ? {}
      : { outputCompression: configuration.outputCompression }),
    background: configuration.background,
    ...(configuration.endUserId ? { endUserId: configuration.endUserId } : {}),
    ...(inputFidelity === "high" ? { inputFidelity } : {}),
    references,
  };
}
