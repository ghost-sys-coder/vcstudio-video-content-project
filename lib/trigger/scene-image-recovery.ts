import "server-only";

import type { ProviderRequest, SceneImageGeneration } from "@/db/schema";
import {
  completeSceneImageGeneration,
  failSceneImageGeneration,
} from "@/db/commands/scene-image-commands";
import { saveSceneVariantFraming } from "@/db/commands/output-variant-commands";
import { createSceneImageObjectKey } from "@/lib/storage/object-key";
import {
  findStoredSceneImage,
  type StoredSceneImage,
} from "@/lib/storage/scene-image-storage";
import {
  getSceneImageDimensions,
  sceneImageApiSizeSchema,
} from "@/lib/schemas/scene-image";

export type SceneImageWorkflowScope = {
  workspaceId: string;
  projectId: string;
  generationId: string;
};

export function getSceneImageGenerationObjectKey(
  generation: Pick<
    SceneImageGeneration,
    | "id"
    | "workspaceId"
    | "projectId"
    | "sceneId"
    | "sceneVersionId"
    | "outputFormat"
  >,
): string {
  return createSceneImageObjectKey({
    workspaceId: generation.workspaceId,
    projectId: generation.projectId,
    sceneId: generation.sceneId,
    sceneVersionId: generation.sceneVersionId,
    generationId: generation.id,
    outputFormat: generation.outputFormat,
  });
}

export async function recoverStoredSceneImage(input: {
  scope: SceneImageWorkflowScope;
  generation: SceneImageGeneration;
  latestProviderRequest: ProviderRequest | null;
}): Promise<StoredSceneImage | null> {
  const objectKey = getSceneImageGenerationObjectKey(input.generation);
  const stored = await findStoredSceneImage({
    objectKey,
    generationId: input.generation.id,
  });
  if (!stored) return null;

  await completeStoredSceneImage({
    scope: input.scope,
    generation: input.generation,
    providerRequest: input.latestProviderRequest,
    stored,
    recoveredFromStorage: true,
  });

  return stored;
}

export async function completeStoredSceneImage(input: {
  scope: SceneImageWorkflowScope;
  generation: SceneImageGeneration;
  providerRequest: ProviderRequest | null;
  stored: StoredSceneImage;
  recoveredFromStorage?: boolean;
}): Promise<void> {
  const { stored } = input;

  const request = input.providerRequest;
  if (!request) throw new Error("STORED_SCENE_IMAGE_PROVIDER_REQUEST_MISSING");
  if (
    request.workspaceId !== input.scope.workspaceId ||
    request.projectId !== input.scope.projectId ||
    request.generationId !== input.scope.generationId ||
    request.model !== input.generation.model ||
    request.status !== "succeeded" ||
    request.actualCostCents !== stored.actualCostCents ||
    request.providerRequestId !== stored.providerRequestId ||
    request.textInputUnits !== stored.textInputUnits ||
    request.imageInputUnits !== stored.imageInputUnits ||
    request.outputUnits !== stored.outputUnits
  )
    throw new Error("STORED_SCENE_IMAGE_PROVIDER_REQUEST_MISMATCH");

  const expectedDimensions = getSceneImageDimensions(
    sceneImageApiSizeSchema.parse(input.generation.size),
  );
  const expectedContentType = {
    webp: "image/webp",
    png: "image/png",
    jpeg: "image/jpeg",
  }[input.generation.outputFormat];
  if (
    stored.width !== expectedDimensions.width ||
    stored.height !== expectedDimensions.height ||
    stored.contentType !== expectedContentType
  )
    throw new Error("STORED_SCENE_IMAGE_CONFIGURATION_MISMATCH");

  await completeSceneImageGeneration({
    ...input.scope,
    attemptNumber: request.attemptNumber,
    providerRequestIdentifier: stored.providerRequestId,
    usage: {
      textInputUnits: stored.textInputUnits,
      imageInputUnits: stored.imageInputUnits,
      outputUnits: stored.outputUnits,
    },
    actualCostCents: stored.actualCostCents,
    asset: {
      objectKey: stored.objectKey,
      contentType: stored.contentType,
      sizeBytes: stored.sizeBytes,
      width: stored.width,
      height: stored.height,
      etag: stored.etag,
    },
    safeMetadata: {
      ...request.safeMetadata,
      recoveredFromStorage: input.recoveredFromStorage ?? false,
      costBasis: stored.costBasis,
    },
  });
  if (
    input.generation.purpose === "variant_outpaint" &&
    input.generation.outputVariantId
  )
    await saveSceneVariantFraming({
      workspaceId: input.generation.workspaceId,
      projectId: input.generation.projectId,
      outputVariantId: input.generation.outputVariantId,
      sceneId: input.generation.sceneId,
      sceneVersionId: input.generation.sceneVersionId,
      sourceImageGenerationId: input.generation.id,
      mode: "outpaint",
      focalPointXBps: 5000,
      focalPointYBps: 5000,
      scaleBps: 10000,
      backgroundColor: "#000000",
      updatedByUserId: input.generation.requestedByUserId,
    });
}

export async function failSceneImageWithConservativeProviderOutcome(input: {
  scope: SceneImageWorkflowScope;
  providerRequest: ProviderRequest;
  reservedCostCents: number;
  category: string;
  safeErrorMessage: string;
}): Promise<void> {
  const { providerRequest } = input;
  const actualCostCents =
    providerRequest.actualCostCents ?? input.reservedCostCents;
  await failSceneImageGeneration({
    ...input.scope,
    attemptNumber: providerRequest.attemptNumber,
    category: input.category,
    safeErrorMessage: input.safeErrorMessage,
    providerRequestStatus:
      providerRequest.status === "succeeded" ? "succeeded" : "failed",
    providerRequestIdentifier: providerRequest.providerRequestId ?? undefined,
    usage: {
      textInputUnits: providerRequest.textInputUnits,
      imageInputUnits: providerRequest.imageInputUnits,
      outputUnits: providerRequest.outputUnits,
    },
    actualCostCents,
    errorCode: input.category,
  });
}
