import "server-only";

import { and, asc, desc, eq, inArray, isNull, lte, max } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  sceneAudioGenerations,
  usageReservations,
  voicePresets,
} from "@/db/schema";

const MAX_LIST_LIMIT = 100;
const MAX_AUDIO_GENERATION_RESULTS = 4_000;

export async function listVoicePresets(input: {
  workspaceId: string;
  includeArchived?: boolean;
}) {
  const conditions = [eq(voicePresets.workspaceId, input.workspaceId)];
  if (!input.includeArchived) conditions.push(isNull(voicePresets.archivedAt));
  return getDatabase()
    .select()
    .from(voicePresets)
    .where(and(...conditions))
    .orderBy(desc(voicePresets.isDefault), asc(voicePresets.name))
    .limit(MAX_LIST_LIMIT);
}

export async function findVoicePreset(input: {
  workspaceId: string;
  voicePresetId: string;
  includeArchived?: boolean;
}) {
  const conditions = [
    eq(voicePresets.workspaceId, input.workspaceId),
    eq(voicePresets.id, input.voicePresetId),
  ];
  if (!input.includeArchived) conditions.push(isNull(voicePresets.archivedAt));
  const [preset] = await getDatabase()
    .select()
    .from(voicePresets)
    .where(and(...conditions))
    .limit(1);
  return preset ?? null;
}

export async function findDefaultVoicePreset(input: { workspaceId: string }) {
  const [preset] = await getDatabase()
    .select()
    .from(voicePresets)
    .where(
      and(
        eq(voicePresets.workspaceId, input.workspaceId),
        eq(voicePresets.isDefault, true),
        isNull(voicePresets.archivedAt),
      ),
    )
    .limit(1);
  return preset ?? null;
}

export async function findSceneAudioGeneration(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
}) {
  const [generation] = await getDatabase()
    .select()
    .from(sceneAudioGenerations)
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        eq(sceneAudioGenerations.id, input.generationId),
      ),
    )
    .limit(1);
  return generation ?? null;
}

export async function findSceneAudioGenerationByRequestNonce(input: {
  workspaceId: string;
  projectId: string;
  requestNonce: string;
}) {
  const [generation] = await getDatabase()
    .select()
    .from(sceneAudioGenerations)
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        eq(sceneAudioGenerations.requestNonce, input.requestNonce),
      ),
    )
    .limit(1);
  return generation ?? null;
}

export async function findSceneAudioGenerationByIdempotencyKey(input: {
  workspaceId: string;
  projectId: string;
  idempotencyKey: string;
}) {
  const [generation] = await getDatabase()
    .select()
    .from(sceneAudioGenerations)
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        eq(sceneAudioGenerations.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  return generation ?? null;
}

export async function getNextSceneAudioGenerationVersion(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionId: string;
}) {
  const [result] = await getDatabase()
    .select({ value: max(sceneAudioGenerations.generationVersion) })
    .from(sceneAudioGenerations)
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        eq(sceneAudioGenerations.sceneVersionId, input.sceneVersionId),
      ),
    );
  return (result?.value ?? 0) + 1;
}

export async function findSceneAudioReservation(input: {
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
        eq(usageReservations.operationType, "scene_audio_generation"),
        eq(usageReservations.audioGenerationId, input.generationId),
      ),
    )
    .limit(1);
  return reservation ?? null;
}

export async function findSceneAudioGenerationWorkflowContext(input: {
  workspaceId: string;
  projectId: string;
  generationId: string;
}) {
  const generation = await findSceneAudioGeneration(input);
  if (!generation) return null;
  const reservation = await findSceneAudioReservation(input);
  return { generation, reservation };
}

export async function listSceneAudioGenerationsForSceneVersions(input: {
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
    .select()
    .from(sceneAudioGenerations)
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        inArray(sceneAudioGenerations.sceneVersionId, sceneVersionIds),
      ),
    )
    .orderBy(
      asc(sceneAudioGenerations.sceneId),
      desc(sceneAudioGenerations.generationVersion),
    )
    .limit(MAX_AUDIO_GENERATION_RESULTS);
}

export async function listSceneAudioGenerationSummaries(input: {
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId?: string;
  limit?: number;
}) {
  const conditions = [
    eq(sceneAudioGenerations.workspaceId, input.workspaceId),
    eq(sceneAudioGenerations.projectId, input.projectId),
    eq(sceneAudioGenerations.sceneId, input.sceneId),
  ];
  if (input.sceneVersionId)
    conditions.push(
      eq(sceneAudioGenerations.sceneVersionId, input.sceneVersionId),
    );
  return getDatabase()
    .select()
    .from(sceneAudioGenerations)
    .where(and(...conditions))
    .orderBy(desc(sceneAudioGenerations.generationVersion))
    .limit(Math.min(input.limit ?? 20, MAX_LIST_LIMIT));
}

export async function listExpiredActiveSceneAudioGenerations(input: {
  now: Date;
  limit?: number;
}) {
  return getDatabase()
    .select({
      workspaceId: sceneAudioGenerations.workspaceId,
      projectId: sceneAudioGenerations.projectId,
      generationId: sceneAudioGenerations.id,
      expiresAt: usageReservations.expiresAt,
    })
    .from(sceneAudioGenerations)
    .innerJoin(
      usageReservations,
      and(
        eq(usageReservations.workspaceId, sceneAudioGenerations.workspaceId),
        eq(usageReservations.projectId, sceneAudioGenerations.projectId),
        eq(usageReservations.operationType, "scene_audio_generation"),
        eq(usageReservations.audioGenerationId, sceneAudioGenerations.id),
      ),
    )
    .where(
      and(
        inArray(sceneAudioGenerations.status, ["pending", "queued", "running"]),
        eq(usageReservations.status, "pending"),
        lte(usageReservations.expiresAt, input.now),
      ),
    )
    .orderBy(
      asc(usageReservations.expiresAt),
      asc(sceneAudioGenerations.createdAt),
    )
    .limit(Math.min(input.limit ?? 100, MAX_LIST_LIMIT));
}
