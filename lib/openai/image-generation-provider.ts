import type { ImageGenerationUsage } from "@/lib/costs/scene-image-cost";
import type { SceneImageProviderConfiguration } from "@/lib/schemas/scene-image";

export const IMAGE_REFERENCE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type ImageReferenceMimeType =
  (typeof IMAGE_REFERENCE_MIME_TYPES)[number];

export type ImageGenerationReference = {
  assetId: string;
  bytes: Uint8Array;
  mimeType: ImageReferenceMimeType;
};

export type ImageGenerationProviderInput = SceneImageProviderConfiguration & {
  references: ImageGenerationReference[];
};

export type ImageGenerationProviderResult = {
  provider: "openai";
  operation: "generate" | "edit";
  model: string;
  requestId: string | null;
  bytes: Uint8Array;
  mimeType: ImageReferenceMimeType;
  width: number;
  height: number;
  usage: ImageGenerationUsage | null;
  safeMetadata: {
    createdAtEpochSeconds: number;
    outputFormat: string;
    quality: string;
    size: string;
    referenceCount: number;
  };
};

export class ImageGenerationProviderResponseError extends Error {
  readonly code: string;
  readonly requestId: string | null;
  readonly usage: ImageGenerationUsage | null;

  constructor(input: {
    code: string;
    requestId: string | null;
    usage: ImageGenerationUsage | null;
  }) {
    super(input.code);
    this.name = "ImageGenerationProviderResponseError";
    this.code = input.code;
    this.requestId = input.requestId;
    this.usage = input.usage;
  }
}

export interface ImageGenerationProvider {
  generate(
    input: ImageGenerationProviderInput,
  ): Promise<ImageGenerationProviderResult>;
}
