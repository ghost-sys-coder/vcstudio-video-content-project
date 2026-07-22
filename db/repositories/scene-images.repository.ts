import "server-only";

import { and, asc, desc, eq, inArray, isNull, lte, max } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  characterReferenceAssets,
  characters,
  generationReferenceAssets,
  promptTemplateVersions,
  providerRequests,
  sceneImageGenerations,
  scenes,
  sceneVersionCharacters,
  sceneVersions,
  stylePresets,
  stylePresetVersions,
  usageReservations,
} from "@/db/schema";

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;
const MAX_GENERATION_REFERENCE_RESULTS = 1_600;

function boundedLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
}

export async function findApprovedCurrentSceneVersion(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId?: string;
}) {
  const conditions = [
    eq(scenes.workspaceId, input.workspaceId),
    eq(scenes.projectId, input.projectId),
    eq(scenes.id, input.sceneId),
    eq(scenes.status, "approved"),
    eq(sceneVersions.workspaceId, input.workspaceId),
    eq(sceneVersions.projectId, input.projectId),
  ];
  if (input.sceneVersionId)
    conditions.push(eq(sceneVersions.id, input.sceneVersionId));

  const [result] = await getDatabase()
    .select({ scene: scenes, version: sceneVersions })
    .from(scenes)
    .innerJoin(
      sceneVersions,
      and(
        eq(sceneVersions.sceneId, scenes.id),
        eq(sceneVersions.versionNumber, scenes.currentVersion),
      ),
    )
    .where(and(...conditions))
    .limit(1);

  return result ?? null;
}

export async function listLatestStylePresetVersions(input: {
  workspaceId: string;
  includeArchived?: boolean;
  limit?: number;
}) {
  const database = getDatabase();
  const latestVersions = database
    .select({
      stylePresetId: stylePresetVersions.stylePresetId,
      version: max(stylePresetVersions.version).as("latest_version"),
    })
    .from(stylePresetVersions)
    .where(eq(stylePresetVersions.workspaceId, input.workspaceId))
    .groupBy(stylePresetVersions.stylePresetId)
    .as("latest_style_preset_versions");

  const conditions = [eq(stylePresets.workspaceId, input.workspaceId)];
  if (!input.includeArchived) conditions.push(isNull(stylePresets.archivedAt));

  return database
    .select({ preset: stylePresets, version: stylePresetVersions })
    .from(stylePresets)
    .innerJoin(
      latestVersions,
      eq(latestVersions.stylePresetId, stylePresets.id),
    )
    .innerJoin(
      stylePresetVersions,
      and(
        eq(stylePresetVersions.workspaceId, input.workspaceId),
        eq(stylePresetVersions.stylePresetId, stylePresets.id),
        eq(stylePresetVersions.version, latestVersions.version),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(stylePresets.isDefault), asc(stylePresetVersions.name))
    .limit(boundedLimit(input.limit));
}

export async function findDefaultStylePresetVersion(input: {
  workspaceId: string;
}) {
  const [result] = await getDatabase()
    .select({ preset: stylePresets, version: stylePresetVersions })
    .from(stylePresets)
    .innerJoin(
      stylePresetVersions,
      and(
        eq(stylePresetVersions.workspaceId, input.workspaceId),
        eq(stylePresetVersions.stylePresetId, stylePresets.id),
      ),
    )
    .where(
      and(
        eq(stylePresets.workspaceId, input.workspaceId),
        eq(stylePresets.isDefault, true),
        isNull(stylePresets.archivedAt),
      ),
    )
    .orderBy(desc(stylePresetVersions.version))
    .limit(1);

  return result ?? null;
}

export async function findStylePresetVersion(input: {
  workspaceId: string;
  stylePresetVersionId: string;
  includeArchived?: boolean;
}) {
  const conditions = [
    eq(stylePresetVersions.workspaceId, input.workspaceId),
    eq(stylePresetVersions.id, input.stylePresetVersionId),
    eq(stylePresets.workspaceId, input.workspaceId),
  ];
  if (!input.includeArchived) conditions.push(isNull(stylePresets.archivedAt));

  const [result] = await getDatabase()
    .select({ preset: stylePresets, version: stylePresetVersions })
    .from(stylePresetVersions)
    .innerJoin(
      stylePresets,
      eq(stylePresets.id, stylePresetVersions.stylePresetId),
    )
    .where(and(...conditions))
    .limit(1);

  return result ?? null;
}

export async function findPromptTemplateVersion(input: {
  templateKey: string;
  version: string;
}) {
  const [template] = await getDatabase()
    .select()
    .from(promptTemplateVersions)
    .where(
      and(
        eq(promptTemplateVersions.templateKey, input.templateKey),
        eq(promptTemplateVersions.version, input.version),
      ),
    )
    .limit(1);

  return template ?? null;
}

export async function listEligibleSceneReferenceAssets(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
  limit?: number;
}) {
  return getDatabase()
    .select({
      assignment: sceneVersionCharacters,
      character: characters,
      reference: characterReferenceAssets,
    })
    .from(sceneVersionCharacters)
    .innerJoin(
      sceneVersions,
      and(
        eq(sceneVersions.id, sceneVersionCharacters.sceneVersionId),
        eq(sceneVersions.workspaceId, input.workspaceId),
        eq(sceneVersions.projectId, input.projectId),
      ),
    )
    .innerJoin(
      characters,
      and(
        eq(characters.id, sceneVersionCharacters.characterId),
        eq(characters.workspaceId, input.workspaceId),
      ),
    )
    .innerJoin(
      characterReferenceAssets,
      and(
        eq(characterReferenceAssets.characterId, characters.id),
        eq(characterReferenceAssets.workspaceId, input.workspaceId),
      ),
    )
    .where(
      and(
        eq(sceneVersionCharacters.workspaceId, input.workspaceId),
        eq(sceneVersionCharacters.projectId, input.projectId),
        eq(sceneVersionCharacters.sceneVersionId, input.sceneVersionId),
      ),
    )
    .orderBy(
      asc(characters.name),
      asc(characterReferenceAssets.type),
      asc(characterReferenceAssets.createdAt),
    )
    .limit(boundedLimit(input.limit));
}

export async function listAssignedSceneCharacters(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
  limit?: number;
}) {
  return getDatabase()
    .select({
      assignment: sceneVersionCharacters,
      character: characters,
    })
    .from(sceneVersionCharacters)
    .innerJoin(
      sceneVersions,
      and(
        eq(sceneVersions.id, sceneVersionCharacters.sceneVersionId),
        eq(sceneVersions.workspaceId, input.workspaceId),
        eq(sceneVersions.projectId, input.projectId),
      ),
    )
    .innerJoin(
      characters,
      and(
        eq(characters.id, sceneVersionCharacters.characterId),
        eq(characters.workspaceId, input.workspaceId),
      ),
    )
    .where(
      and(
        eq(sceneVersionCharacters.workspaceId, input.workspaceId),
        eq(sceneVersionCharacters.projectId, input.projectId),
        eq(sceneVersionCharacters.sceneVersionId, input.sceneVersionId),
      ),
    )
    .orderBy(asc(characters.name), asc(characters.id))
    .limit(boundedLimit(input.limit));
}

export async function findEligibleSceneReferenceAssetsByIds(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
  referenceAssetIds: string[];
}) {
  if (!input.referenceAssetIds.length) return [];
  if (input.referenceAssetIds.length > MAX_LIST_LIMIT)
    throw new Error("SCENE_IMAGE_REFERENCE_QUERY_LIMIT_EXCEEDED");

  return getDatabase()
    .select({
      assignment: sceneVersionCharacters,
      character: characters,
      reference: characterReferenceAssets,
    })
    .from(sceneVersionCharacters)
    .innerJoin(
      sceneVersions,
      and(
        eq(sceneVersions.id, sceneVersionCharacters.sceneVersionId),
        eq(sceneVersions.workspaceId, input.workspaceId),
        eq(sceneVersions.projectId, input.projectId),
      ),
    )
    .innerJoin(
      characters,
      and(
        eq(characters.id, sceneVersionCharacters.characterId),
        eq(characters.workspaceId, input.workspaceId),
      ),
    )
    .innerJoin(
      characterReferenceAssets,
      and(
        eq(characterReferenceAssets.characterId, characters.id),
        eq(characterReferenceAssets.workspaceId, input.workspaceId),
      ),
    )
    .where(
      and(
        eq(sceneVersionCharacters.workspaceId, input.workspaceId),
        eq(sceneVersionCharacters.projectId, input.projectId),
        eq(sceneVersionCharacters.sceneVersionId, input.sceneVersionId),
        inArray(characterReferenceAssets.id, input.referenceAssetIds),
      ),
    )
    .orderBy(asc(characterReferenceAssets.id));
}

export async function findSceneImageGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
}) {
  const [generation] = await getDatabase()
    .select()
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        eq(sceneImageGenerations.id, input.generationId),
      ),
    )
    .limit(1);

  return generation ?? null;
}

export async function listSucceededSceneImageGenerationsByIds(input: {
  workspaceId: string;
  projectId: string;
  generationIds: string[];
}) {
  if (input.generationIds.length === 0) return [];
  return getDatabase()
    .select()
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        inArray(sceneImageGenerations.id, input.generationIds),
        eq(sceneImageGenerations.status, "succeeded"),
      ),
    );
}

export async function findSceneImageGenerationByRequestNonce(input: {
  workspaceId: string;
  projectId: string;
  requestNonce: string;
}) {
  const [generation] = await getDatabase()
    .select()
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        eq(sceneImageGenerations.requestNonce, input.requestNonce),
      ),
    )
    .limit(1);

  return generation ?? null;
}

export async function findSceneImageGenerationByIdempotencyKey(input: {
  workspaceId: string;
  projectId: string;
  idempotencyKey: string;
}) {
  const [generation] = await getDatabase()
    .select()
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        eq(sceneImageGenerations.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);

  return generation ?? null;
}

export async function getNextSceneImageGenerationVersion(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
}) {
  const [result] = await getDatabase()
    .select({ value: max(sceneImageGenerations.generationVersion) })
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        eq(sceneImageGenerations.sceneVersionId, input.sceneVersionId),
      ),
    );

  return (result?.value ?? 0) + 1;
}

export async function listSceneImageGenerationSummaries(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId?: string;
  limit?: number;
}) {
  const conditions = [
    eq(sceneImageGenerations.workspaceId, input.workspaceId),
    eq(sceneImageGenerations.projectId, input.projectId),
    eq(sceneImageGenerations.sceneId, input.sceneId),
    eq(stylePresetVersions.workspaceId, input.workspaceId),
    eq(stylePresets.workspaceId, input.workspaceId),
  ];
  if (input.sceneVersionId)
    conditions.push(
      eq(sceneImageGenerations.sceneVersionId, input.sceneVersionId),
    );

  return getDatabase()
    .select({
      generation: sceneImageGenerations,
      stylePreset: stylePresets,
      stylePresetVersion: stylePresetVersions,
      reservationStatus: usageReservations.status,
    })
    .from(sceneImageGenerations)
    .innerJoin(
      stylePresetVersions,
      eq(stylePresetVersions.id, sceneImageGenerations.stylePresetVersionId),
    )
    .innerJoin(
      stylePresets,
      eq(stylePresets.id, stylePresetVersions.stylePresetId),
    )
    .leftJoin(
      usageReservations,
      and(
        eq(usageReservations.workspaceId, input.workspaceId),
        eq(usageReservations.projectId, input.projectId),
        eq(usageReservations.imageGenerationId, sceneImageGenerations.id),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(sceneImageGenerations.generationVersion))
    .limit(boundedLimit(input.limit));
}

export async function listGenerationReferenceAssets(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
}) {
  return getDatabase()
    .select({ reference: generationReferenceAssets })
    .from(generationReferenceAssets)
    .innerJoin(
      sceneImageGenerations,
      and(
        eq(sceneImageGenerations.id, generationReferenceAssets.generationId),
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
      ),
    )
    .where(
      and(
        eq(generationReferenceAssets.workspaceId, input.workspaceId),
        eq(generationReferenceAssets.generationId, input.generationId),
      ),
    )
    .orderBy(asc(generationReferenceAssets.position))
    .limit(MAX_LIST_LIMIT);
}

export async function listGenerationReferenceAssetsForGenerations(input: {
  workspaceId: string;
  projectId: string;
  generationIds: string[];
}) {
  const generationIds = [...new Set(input.generationIds)].slice(
    0,
    MAX_LIST_LIMIT,
  );
  if (!generationIds.length) return [];

  return getDatabase()
    .select({
      generationId: generationReferenceAssets.generationId,
      reference: generationReferenceAssets,
    })
    .from(generationReferenceAssets)
    .innerJoin(
      sceneImageGenerations,
      and(
        eq(sceneImageGenerations.id, generationReferenceAssets.generationId),
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
      ),
    )
    .where(
      and(
        eq(generationReferenceAssets.workspaceId, input.workspaceId),
        inArray(generationReferenceAssets.generationId, generationIds),
      ),
    )
    .orderBy(
      asc(generationReferenceAssets.generationId),
      asc(generationReferenceAssets.position),
    )
    .limit(MAX_GENERATION_REFERENCE_RESULTS);
}

export async function findSceneImageGenerationReference(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  referenceAssetIdSnapshot: string;
}) {
  const [result] = await getDatabase()
    .select({ reference: generationReferenceAssets })
    .from(generationReferenceAssets)
    .innerJoin(
      sceneImageGenerations,
      and(
        eq(sceneImageGenerations.id, generationReferenceAssets.generationId),
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
      ),
    )
    .where(
      and(
        eq(generationReferenceAssets.workspaceId, input.workspaceId),
        eq(generationReferenceAssets.generationId, input.generationId),
        eq(
          generationReferenceAssets.referenceAssetIdSnapshot,
          input.referenceAssetIdSnapshot,
        ),
      ),
    )
    .limit(1);

  return result?.reference ?? null;
}

export async function findSceneImageProviderRequest(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
  attemptNumber?: number;
}) {
  const conditions = [
    eq(providerRequests.workspaceId, input.workspaceId),
    eq(providerRequests.projectId, input.projectId),
    eq(providerRequests.generationId, input.generationId),
  ];
  if (input.attemptNumber !== undefined)
    conditions.push(eq(providerRequests.attemptNumber, input.attemptNumber));

  const [request] = await getDatabase()
    .select()
    .from(providerRequests)
    .where(and(...conditions))
    .orderBy(desc(providerRequests.attemptNumber))
    .limit(1);

  return request ?? null;
}

export async function findSceneImageReservation(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
}) {
  const [reservation] = await getDatabase()
    .select()
    .from(usageReservations)
    .where(
      and(
        eq(usageReservations.workspaceId, input.workspaceId),
        eq(usageReservations.projectId, input.projectId),
        eq(usageReservations.operationType, "scene_image_generation"),
        eq(usageReservations.imageGenerationId, input.generationId),
      ),
    )
    .limit(1);

  return reservation ?? null;
}

export async function findSceneImageGenerationWorkflowContext(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
}) {
  const generation = await findSceneImageGeneration(input);
  if (!generation) return null;

  const [reservation, references, latestProviderRequest] = await Promise.all([
    findSceneImageReservation(input),
    listGenerationReferenceAssets(input),
    findSceneImageProviderRequest(input),
  ]);

  return {
    generation,
    reservation,
    references: references.map(({ reference }) => reference),
    latestProviderRequest,
  };
}

const MAX_STORYBOARD_GENERATION_RESULTS = 4_000;

export async function listSceneImageGenerationsForSceneVersions(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionIds: string[];
}) {
  const sceneVersionIds = [...new Set(input.sceneVersionIds)].slice(
    0,
    MAX_LIST_LIMIT * 2,
  );
  if (!sceneVersionIds.length) return [];

  return getDatabase()
    .select({
      id: sceneImageGenerations.id,
      sceneId: sceneImageGenerations.sceneId,
      sceneVersionId: sceneImageGenerations.sceneVersionId,
      batchId: sceneImageGenerations.batchId,
      generationVersion: sceneImageGenerations.generationVersion,
      status: sceneImageGenerations.status,
      reviewStatus: sceneImageGenerations.reviewStatus,
      assetObjectKey: sceneImageGenerations.assetObjectKey,
      estimatedCostCents: sceneImageGenerations.estimatedCostCents,
      actualCostCents: sceneImageGenerations.actualCostCents,
      progressPercent: sceneImageGenerations.progressPercent,
      safeErrorMessage: sceneImageGenerations.safeErrorMessage,
      createdAt: sceneImageGenerations.createdAt,
    })
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        inArray(sceneImageGenerations.sceneVersionId, sceneVersionIds),
      ),
    )
    .orderBy(
      asc(sceneImageGenerations.sceneId),
      desc(sceneImageGenerations.generationVersion),
    )
    .limit(MAX_STORYBOARD_GENERATION_RESULTS);
}

export async function listExpiredActiveSceneImageGenerations(input: {
  now: Date;
  limit?: number;
}) {
  return getDatabase()
    .select({
      workspaceId: sceneImageGenerations.workspaceId,
      projectId: sceneImageGenerations.projectId,
      generationId: sceneImageGenerations.id,
      expiresAt: usageReservations.expiresAt,
    })
    .from(sceneImageGenerations)
    .innerJoin(
      usageReservations,
      and(
        eq(usageReservations.workspaceId, sceneImageGenerations.workspaceId),
        eq(usageReservations.projectId, sceneImageGenerations.projectId),
        eq(usageReservations.operationType, "scene_image_generation"),
        eq(usageReservations.imageGenerationId, sceneImageGenerations.id),
      ),
    )
    .where(
      and(
        inArray(sceneImageGenerations.status, ["pending", "queued", "running"]),
        eq(usageReservations.status, "pending"),
        lte(usageReservations.expiresAt, input.now),
      ),
    )
    .orderBy(
      asc(usageReservations.expiresAt),
      asc(sceneImageGenerations.createdAt),
    )
    .limit(boundedLimit(input.limit));
}

export {
  getProjectCommittedCostCents,
  getWorkspaceCommittedCostCents,
} from "@/db/repositories/scenes.repository";
