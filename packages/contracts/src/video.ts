import { z } from "zod";

export const videoProviderIdSchema = z.enum([
  "google_gemini",
  "google_vertex",
  "runway",
  "luma",
  "kling",
  "seedance",
  "wan",
  "minimax",
]);
export type VideoProviderId = z.infer<typeof videoProviderIdSchema>;

export const videoGenerationModeSchema = z.enum([
  "text_to_video",
  "image_to_video",
  "reference_to_video",
]);
export const videoAspectRatioSchema = z.enum([
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "21:9",
]);
export const videoResolutionSchema = z.enum([
  "360p",
  "480p",
  "540p",
  "720p",
  "1080p",
  "4k",
]);
export const videoAudioModeSchema = z.enum(["none", "native"]);
export const videoInputRoleSchema = z.enum([
  "first_frame",
  "last_frame",
  "reference",
  "character",
  "product",
  "style",
]);

export const videoInputAssetSchema = z
  .object({
    assetId: z.uuid(),
    source: z.enum(["library", "scene_image"]).optional(),
    role: videoInputRoleSchema,
  })
  .strict();

export const videoGenerationTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("direct") }).strict(),
  z
    .object({
      kind: z.literal("scene"),
      projectId: z.uuid(),
      sceneId: z.uuid(),
      sceneVersionId: z.uuid(),
      expectedSceneVersion: z.number().int().positive(),
    })
    .strict(),
]);

/** Asset identifiers are resolved and authorized server-side; URLs are not input. */
export const videoGenerationRequestSchema = z
  .object({
    modelId: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9][a-z0-9._:-]*$/),
    title: z.string().trim().min(1).max(160),
    prompt: z.string().trim().min(5).max(10_000),
    negativePrompt: z.string().trim().max(2_000).default(""),
    mode: videoGenerationModeSchema,
    aspectRatio: videoAspectRatioSchema,
    resolution: videoResolutionSchema,
    durationSeconds: z.number().int().min(1).max(120),
    audio: videoAudioModeSchema.default("none"),
    seed: z.number().int().min(0).max(2_147_483_647).nullable().default(null),
    fit: z.enum(["contain", "cover"]).default("contain"),
    inputs: z.array(videoInputAssetSchema).max(8).default([]),
    target: videoGenerationTargetSchema.default({ kind: "direct" }),
  })
  .strict()
  .superRefine((request, context) => {
    const seen = new Set<string>();
    for (const [index, input] of request.inputs.entries()) {
      const identity = `${input.source ?? "library"}:${input.role}:${input.assetId}`;
      if (seen.has(identity))
        context.addIssue({
          code: "custom",
          path: ["inputs", index],
          message: "This asset already has that role.",
        });
      seen.add(identity);
      if (input.source === "scene_image" && request.target.kind !== "scene")
        context.addIssue({
          code: "custom",
          path: ["inputs", index],
          message: "Project image references require an explicit scene target.",
        });
    }
    for (const role of ["first_frame", "last_frame"] as const) {
      if (request.inputs.filter((input) => input.role === role).length > 1)
        context.addIssue({
          code: "custom",
          path: ["inputs"],
          message: `Choose one ${role.replace("_", " ")}.`,
        });
    }
    const first = request.inputs.some((input) => input.role === "first_frame");
    if (request.mode === "text_to_video" && request.inputs.length)
      context.addIssue({
        code: "custom",
        path: ["inputs"],
        message: "Choose an image or reference mode to use attached assets.",
      });
    if (request.mode === "image_to_video" && !first)
      context.addIssue({
        code: "custom",
        path: ["inputs"],
        message: "Choose a first frame for image-to-video.",
      });
    if (
      request.mode === "image_to_video" &&
      request.inputs.some(
        (input) => !["first_frame", "last_frame"].includes(input.role),
      )
    )
      context.addIssue({
        code: "custom",
        path: ["inputs"],
        message:
          "Image-to-video uses a first frame and optional last frame. Choose reference mode for other roles.",
      });
    if (
      request.mode === "reference_to_video" &&
      request.inputs.some((input) =>
        ["first_frame", "last_frame"].includes(input.role),
      )
    )
      context.addIssue({
        code: "custom",
        path: ["inputs"],
        message:
          "Use image-to-video when a reference must be the first or last frame.",
      });
    if (request.mode === "reference_to_video" && !request.inputs.length)
      context.addIssue({
        code: "custom",
        path: ["inputs"],
        message: "Choose a reference asset.",
      });
    if (request.inputs.some((input) => input.role === "last_frame") && !first)
      context.addIssue({
        code: "custom",
        path: ["inputs"],
        message: "A last frame requires a first frame.",
      });
  });
export type VideoGenerationRequest = z.infer<
  typeof videoGenerationRequestSchema
>;
export type VideoGenerationTarget = z.infer<typeof videoGenerationTargetSchema>;
export type VideoInputAsset = z.infer<typeof videoInputAssetSchema>;

export const videoOutputOptionSchema = z
  .object({
    modes: z.array(videoGenerationModeSchema).min(1).optional(),
    aspectRatio: videoAspectRatioSchema,
    resolution: videoResolutionSchema,
    width: z.number().int().min(128).max(7680),
    height: z.number().int().min(128).max(7680),
    durationsSeconds: z.array(z.number().int().min(1).max(120)).min(1).max(120),
  })
  .strict();

export const videoModelDescriptorSchema = z
  .object({
    id: z.string().min(1).max(100),
    provider: videoProviderIdSchema,
    providerModelId: z.string().min(1).max(200),
    name: z.string().min(1).max(120),
    description: z.string().max(600),
    version: z.string().min(1).max(100),
    modes: z.array(videoGenerationModeSchema).min(1),
    outputs: z.array(videoOutputOptionSchema).min(1).max(60),
    inputRoles: z.array(videoInputRoleSchema),
    maxInputs: z.number().int().min(0).max(8),
    audioModes: z.array(videoAudioModeSchema).min(1),
    supportsSeed: z.boolean(),
    audioGeneration: z.enum(["none", "optional", "always"]),
    durationControl: z.enum(["strict", "prompt"]),
    supportsNegativePrompt: z.boolean(),
    supportsCancellation: z.boolean(),
    maxPromptCharacters: z.number().int().min(5).max(10_000),
    referenceDurationsSeconds: z.array(z.number().int().positive()).optional(),
    documentationUrl: z.url(),
    verifiedAt: z.iso.date(),
    retired: z.boolean().default(false),
  })
  .strict();
export type VideoModelDescriptor = z.infer<typeof videoModelDescriptorSchema>;

/** Rates are explicit operator configuration, never inferred from a model name. */
export const videoModelPricingSchema = z
  .object({
    modelId: z.string().min(1).max(100),
    revision: z.string().min(1).max(100),
    currency: z.literal("USD"),
    sourceUrl: z.url(),
    overheadCents: z.number().int().nonnegative().max(100_000).default(0),
    perInputCents: z.number().int().nonnegative().max(100_000).default(0),
    safetyMarginBps: z.number().int().min(0).max(10_000).default(0),
    tokenPricing: z
      .object({
        inputUsdPerMillion: z.number().nonnegative(),
        textUsdPerMillion: z.number().nonnegative(),
        videoUsdPerMillion: z.number().nonnegative(),
      })
      .strict()
      .optional(),
    creditUsdMicros: z.number().int().positive().max(1_000_000).optional(),
    rates: z
      .array(
        z
          .object({
            mode: videoGenerationModeSchema.optional(),
            resolution: videoResolutionSchema,
            audio: videoAudioModeSchema,
            durationSeconds: z.number().int().positive().max(120).optional(),
            usdMicrosPerSecond: z.number().int().positive().max(1_000_000_000),
            minimumCents: z.number().int().nonnegative().max(1_000_000),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();
export type VideoModelPricing = z.infer<typeof videoModelPricingSchema>;

export const videoGenerationStatusSchema = z.enum([
  "queued",
  "submitting",
  "running",
  "inspecting",
  "succeeded",
  "failed",
  "cancelled",
  "requires_reconciliation",
]);
export type VideoGenerationStatus = z.infer<typeof videoGenerationStatusSchema>;

export const videoGenerationStartSchema = z
  .object({
    request: videoGenerationRequestSchema,
    quoteToken: z.string().min(20).max(12_000),
    idempotencyKey: z
      .string()
      .min(16)
      .max(160)
      .regex(/^[A-Za-z0-9._:-]+$/),
  })
  .strict();

export const sceneVisualSelectionSchema = z
  .object({
    projectId: z.uuid(),
    sceneId: z.uuid(),
    sceneVersionId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    kind: z.enum(["inherit", "image", "video"]),
    assetId: z.uuid().nullable().default(null),
    fit: z.enum(["contain", "cover"]).default("contain"),
    trimStartMilliseconds: z
      .number()
      .int()
      .nonnegative()
      .max(3_600_000)
      .default(0),
    loop: z.boolean().default(false),
  })
  .strict()
  .superRefine((selection, context) => {
    if (selection.kind !== "video" && selection.assetId !== null)
      context.addIssue({
        code: "custom",
        path: ["assetId"],
        message: "Only video selection may bind a video asset.",
      });
  });
export type SceneVisualSelectionInput = z.infer<
  typeof sceneVisualSelectionSchema
>;
