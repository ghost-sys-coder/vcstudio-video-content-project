import { describe, expect, it } from "vitest";
import {
  getOpenAiReferenceInputFidelitySnapshot,
  prepareOpenAiImageRequest,
  type PreparedOpenAiImageRequest,
} from "@/lib/openai/image-generation-request";
import type { ImageGenerationProviderInput } from "@/lib/openai/image-generation-provider";

function createInput(
  overrides: Partial<ImageGenerationProviderInput> = {},
): ImageGenerationProviderInput {
  return {
    model: "gpt-image-2",
    prompt: "Draw a clear financial education scene.",
    quality: "low",
    size: "1536x1024",
    outputFormat: "webp",
    outputCompression: 80,
    background: "opaque",
    references: [],
    ...overrides,
  };
}

function expectNoInputFidelity(request: PreparedOpenAiImageRequest): void {
  expect(request).not.toHaveProperty("inputFidelity");
}

describe("prepareOpenAiImageRequest", () => {
  it("uses generation when no reference assets are selected", () => {
    const request = prepareOpenAiImageRequest(createInput());
    expect(request.operation).toBe("generate");
    expect(request.outputFormat).toBe("webp");
    expect(request.outputCompression).toBe(80);
  });

  it("uses edit, sorts references, and omits input_fidelity for GPT Image 2", () => {
    const request = prepareOpenAiImageRequest(
      createInput({
        references: [
          {
            assetId: "reference-b",
            bytes: new Uint8Array([2]),
            mimeType: "image/png",
          },
          {
            assetId: "reference-a",
            bytes: new Uint8Array([1]),
            mimeType: "image/webp",
          },
        ],
      }),
    );
    expect(request.operation).toBe("edit");
    expect(request.references.map(({ assetId }) => assetId)).toEqual([
      "reference-a",
      "reference-b",
    ]);
    expectNoInputFidelity(request);
  });

  it("requests high input fidelity for models that support the option", () => {
    expect(
      prepareOpenAiImageRequest(
        createInput({
          model: "gpt-image-1.5",
          references: [
            {
              assetId: "reference-a",
              bytes: new Uint8Array([1]),
              mimeType: "image/jpeg",
            },
          ],
        }),
      ).inputFidelity,
    ).toBe("high");
  });

  it("omits compression for PNG", () => {
    const request = prepareOpenAiImageRequest(
      createInput({ outputFormat: "png", outputCompression: 90 }),
    );
    expect(request).not.toHaveProperty("outputCompression");
  });
});

describe("getOpenAiReferenceInputFidelitySnapshot", () => {
  it("records automatic high fidelity for GPT Image 2 without sending the unsupported parameter", () => {
    expect(
      getOpenAiReferenceInputFidelitySnapshot({
        model: "gpt-image-2-2026-04-21",
        hasReferences: true,
      }),
    ).toBe("automatic_high");
  });

  it("records explicit high fidelity only for supporting models", () => {
    expect(
      getOpenAiReferenceInputFidelitySnapshot({
        model: "gpt-image-1.5",
        hasReferences: true,
      }),
    ).toBe("high");
    expect(
      getOpenAiReferenceInputFidelitySnapshot({
        model: "gpt-image-2",
        hasReferences: false,
      }),
    ).toBeNull();
  });
});
