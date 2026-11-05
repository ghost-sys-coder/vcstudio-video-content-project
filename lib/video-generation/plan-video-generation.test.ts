import { describe, expect, it } from "vitest";
import {
  videoGenerationRequestSchema,
  videoGenerationStartSchema,
  sceneVisualSelectionSchema,
} from "@studio/contracts/video";
import { planVideoGeneration } from "./plan-video-generation";
import {
  syntheticVideoModel as model,
  syntheticVideoPricing as pricing,
  syntheticVideoRequest as request,
} from "./video-generation-fixtures";

const assetId = "11111111-1111-4111-8111-111111111111";
describe("shared direct/scene video planning", () => {
  it("reserves the maximum possible length for prompt-guided duration models", () => {
    expect(
      planVideoGeneration({
        request,
        model: { ...model, durationControl: "prompt" },
        pricing,
      }),
    ).toMatchObject({ reservationDurationSeconds: 8, estimatedCostCents: 21 });
  });
  it("prices request overhead and inputs before applying the safety reserve", () => {
    const imageRequest = {
      ...request,
      mode: "image_to_video" as const,
      inputs: [{ assetId, role: "first_frame" as const }],
    };
    expect(
      planVideoGeneration({
        request: imageRequest,
        model,
        pricing: {
          ...pricing,
          overheadCents: 5,
          perInputCents: 4,
          safetyMarginBps: 2500,
        },
      }).estimatedCostCents,
    ).toBe(25);
  });
  it("does not impose the historical scene-only 720p ceiling on direct output", () => {
    const highModel = {
      ...model,
      outputs: [
        {
          aspectRatio: "16:9" as const,
          resolution: "4k" as const,
          width: 3840,
          height: 2160,
          durationsSeconds: [4],
        },
      ],
    };
    const highPrice = {
      ...pricing,
      rates: pricing.rates.map((rate) => ({
        ...rate,
        resolution: "4k" as const,
      })),
    };
    expect(
      planVideoGeneration({
        request: { ...request, resolution: "4k" },
        model: highModel,
        pricing: highPrice,
      }),
    ).toMatchObject({ width: 3840, height: 2160 });
  });
  it("keeps per-mode shape restrictions and prices distinct", () => {
    expect(() =>
      planVideoGeneration({
        request,
        model: {
          ...model,
          outputs: model.outputs.map((output) => ({
            ...output,
            modes: ["image_to_video"],
          })),
        },
        pricing,
      }),
    ).toThrow("shape and resolution");
    const special = {
      ...pricing.rates[0]!,
      mode: "text_to_video" as const,
      usdMicrosPerSecond: 100_000,
    };
    expect(
      planVideoGeneration({
        request,
        model,
        pricing: { ...pricing, rates: [...pricing.rates, special] },
      }).estimatedCostCents,
    ).toBe(40);
  });
  it("allows a direct job without any project, narration, scene or starting image", () => {
    const planned = planVideoGeneration({ request, model, pricing });
    expect(planned.request.target).toEqual({ kind: "direct" });
    expect(planned).toMatchObject({
      width: 1280,
      height: 720,
      estimatedCostCents: 11,
      providerAudio: false,
      muteOutput: true,
    });
    expect(planned.request).toEqual(request);
  });
  it("keeps model-generated sound an explicit choice and prices it", () => {
    expect(
      planVideoGeneration({
        request: { ...request, audio: "native" },
        model,
        pricing,
      }),
    ).toMatchObject({
      providerAudio: true,
      muteOutput: false,
      estimatedCostCents: 20,
    });
  });
  it("does not discount an always-audio provider when the output is muted", () => {
    expect(
      planVideoGeneration({
        request,
        model: { ...model, audioGeneration: "always" },
        pricing,
      }),
    ).toMatchObject({
      providerAudio: true,
      muteOutput: true,
      estimatedCostCents: 20,
    });
  });
  it("refuses unknown prices, retired models and unsupported controls", () => {
    expect(() =>
      planVideoGeneration({ request, model, pricing: null }),
    ).toThrow("Pricing must");
    expect(() =>
      planVideoGeneration({
        request,
        model: { ...model, retired: true },
        pricing,
      }),
    ).toThrow("retired");
    expect(() =>
      planVideoGeneration({
        request: { ...request, resolution: "4k" },
        model,
        pricing,
      }),
    ).toThrow("shape and resolution");
    expect(() =>
      planVideoGeneration({
        request: { ...request, durationSeconds: 7 },
        model,
        pricing,
      }),
    ).toThrow("supported duration");
    expect(() =>
      planVideoGeneration({
        request: { ...request, seed: 0 },
        model: { ...model, supportsSeed: false },
        pricing,
      }),
    ).toThrow("seed");
    expect(() =>
      planVideoGeneration({
        request: { ...request, negativePrompt: "no text" },
        model: { ...model, supportsNegativePrompt: false },
        pricing,
      }),
    ).toThrow("negative prompt");
  });
  it("validates source roles and reference-specific duration constraints", () => {
    const withReference = {
      ...request,
      mode: "reference_to_video" as const,
      inputs: [{ assetId, role: "product" as const }],
    };
    expect(() =>
      planVideoGeneration({
        request: withReference,
        model: { ...model, referenceDurationsSeconds: [8] },
        pricing,
      }),
    ).toThrow("different clip duration");
    expect(() =>
      planVideoGeneration({
        request: withReference,
        model: { ...model, inputRoles: ["first_frame"] },
        pricing,
      }),
    ).toThrow("role");
    expect(
      planVideoGeneration({ request: withReference, model, pricing }).request
        .inputs,
    ).toEqual(withReference.inputs);
  });
  it("requires a first frame for image generation and rejects duplicate roles", () => {
    expect(
      videoGenerationRequestSchema.safeParse({
        ...request,
        mode: "image_to_video",
      }).success,
    ).toBe(false);
    expect(
      videoGenerationRequestSchema.safeParse({
        ...request,
        mode: "image_to_video",
        inputs: [
          { assetId, role: "first_frame" },
          { assetId, role: "first_frame" },
        ],
      }).success,
    ).toBe(false);
    expect(
      videoGenerationRequestSchema.safeParse({
        ...request,
        inputs: [{ assetId, role: "reference" }],
      }).success,
    ).toBe(false);
    expect(
      videoGenerationRequestSchema.safeParse({
        ...request,
        mode: "image_to_video",
        inputs: [{ assetId, role: "last_frame" }],
      }).success,
    ).toBe(false);
  });
  it("does not accept arbitrary remote URLs, client prices or unsigned starts", () => {
    expect(
      videoGenerationRequestSchema.safeParse({
        ...request,
        sourceUrl: "http://127.0.0.1/private",
      }).success,
    ).toBe(false);
    expect(
      videoGenerationRequestSchema.safeParse({
        ...request,
        estimatedCostCents: 0,
      }).success,
    ).toBe(false);
    expect(
      videoGenerationStartSchema.safeParse({
        request,
        confirmed: true,
        idempotencyKey: "test-request-key-123",
      }).success,
    ).toBe(false);
  });
  it("supports explicit project overrides without relabelling an image as a clip", () => {
    expect(
      sceneVisualSelectionSchema.parse({
        projectId: assetId,
        sceneId: assetId,
        sceneVersionId: assetId,
        expectedRevision: 0,
        kind: "image",
      }),
    ).toMatchObject({
      kind: "image",
      assetId: null,
      fit: "contain",
      loop: false,
    });
    expect(
      sceneVisualSelectionSchema.safeParse({
        projectId: assetId,
        sceneId: assetId,
        sceneVersionId: assetId,
        expectedRevision: 0,
        kind: "image",
        assetId,
      }).success,
    ).toBe(false);
  });
});
