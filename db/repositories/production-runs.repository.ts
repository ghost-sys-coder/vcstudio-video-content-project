import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  productionRunEvents,
  productionRunGateResults,
  productionRuns,
  sceneAudioGenerations,
  sceneImageGenerations,
  type ProductionRun,
  type ProductionRunEvent,
  type ProductionRunGateResult,
} from "@/db/schema";
import { ACTIVE_PRODUCTION_RUN_STATUSES } from "@/lib/production-runs/production-run-state";

/** Events and gate results are bounded per run; a run is a handful of stages. */
const MAX_EVENTS = 200;
const MAX_GATE_RESULTS = 400;

export async function findProductionRun(input: {
  workspaceId: string;
  runId: string;
}): Promise<ProductionRun | null> {
  const [run] = await getDatabase()
    .select()
    .from(productionRuns)
    .where(
      and(
        eq(productionRuns.workspaceId, input.workspaceId),
        eq(productionRuns.id, input.runId),
      ),
    )
    .limit(1);
  return run ?? null;
}

/** The run that currently owns the project, if any: queued, running or held. */
export async function findOpenProductionRun(input: {
  workspaceId: string;
  projectId: string;
}): Promise<ProductionRun | null> {
  const [run] = await getDatabase()
    .select()
    .from(productionRuns)
    .where(
      and(
        eq(productionRuns.workspaceId, input.workspaceId),
        eq(productionRuns.projectId, input.projectId),
        inArray(productionRuns.status, [
          ...ACTIVE_PRODUCTION_RUN_STATUSES,
          "held",
        ]),
      ),
    )
    .orderBy(desc(productionRuns.createdAt))
    .limit(1);
  return run ?? null;
}

export async function findLatestProductionRun(input: {
  workspaceId: string;
  projectId: string;
}): Promise<ProductionRun | null> {
  const [run] = await getDatabase()
    .select()
    .from(productionRuns)
    .where(
      and(
        eq(productionRuns.workspaceId, input.workspaceId),
        eq(productionRuns.projectId, input.projectId),
      ),
    )
    .orderBy(desc(productionRuns.createdAt))
    .limit(1);
  return run ?? null;
}

export async function listProductionRunEvents(input: {
  workspaceId: string;
  runId: string;
}): Promise<ProductionRunEvent[]> {
  return getDatabase()
    .select()
    .from(productionRunEvents)
    .where(
      and(
        eq(productionRunEvents.workspaceId, input.workspaceId),
        eq(productionRunEvents.runId, input.runId),
      ),
    )
    .orderBy(asc(productionRunEvents.createdAt), asc(productionRunEvents.id))
    .limit(MAX_EVENTS);
}

export async function listProductionRunGateResults(input: {
  workspaceId: string;
  runId: string;
}): Promise<ProductionRunGateResult[]> {
  return getDatabase()
    .select()
    .from(productionRunGateResults)
    .where(
      and(
        eq(productionRunGateResults.workspaceId, input.workspaceId),
        eq(productionRunGateResults.runId, input.runId),
      ),
    )
    .orderBy(
      asc(productionRunGateResults.createdAt),
      asc(productionRunGateResults.id),
    )
    .limit(MAX_GATE_RESULTS);
}

/**
 * The newest scene image per current scene version at one size and shot 0,
 * with the columns the image gate measures. Bounded by the version ids given.
 */
export async function listLatestSceneImagesForGate(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionIds: string[];
  size: string;
}) {
  const sceneVersionIds = [...new Set(input.sceneVersionIds)].slice(0, 500);
  if (sceneVersionIds.length === 0) return [];
  return getDatabase()
    .selectDistinctOn([sceneImageGenerations.sceneVersionId], {
      id: sceneImageGenerations.id,
      sceneVersionId: sceneImageGenerations.sceneVersionId,
      status: sceneImageGenerations.status,
      reviewStatus: sceneImageGenerations.reviewStatus,
      assetObjectKey: sceneImageGenerations.assetObjectKey,
      assetWidth: sceneImageGenerations.assetWidth,
      assetHeight: sceneImageGenerations.assetHeight,
      safeErrorMessage: sceneImageGenerations.safeErrorMessage,
      estimatedCostCents: sceneImageGenerations.estimatedCostCents,
    })
    .from(sceneImageGenerations)
    .where(
      and(
        eq(sceneImageGenerations.workspaceId, input.workspaceId),
        eq(sceneImageGenerations.projectId, input.projectId),
        inArray(sceneImageGenerations.sceneVersionId, sceneVersionIds),
        eq(sceneImageGenerations.size, input.size),
        eq(sceneImageGenerations.shotIndex, 0),
        eq(sceneImageGenerations.purpose, "scene"),
      ),
    )
    .orderBy(
      sceneImageGenerations.sceneVersionId,
      // An approved image outranks a newer unapproved one: a person's decision
      // must not be hidden behind a regeneration that came after it.
      sql`case when ${sceneImageGenerations.reviewStatus} = 'approved' and ${sceneImageGenerations.status} = 'succeeded' then 0 else 1 end`,
      desc(sceneImageGenerations.generationVersion),
    );
}

/** The newest narration clip per current scene version, for the audio gate. */
export async function listLatestSceneAudioForGate(input: {
  workspaceId: string;
  projectId: string;
  sceneVersionIds: string[];
}) {
  const sceneVersionIds = [...new Set(input.sceneVersionIds)].slice(0, 500);
  if (sceneVersionIds.length === 0) return [];
  return getDatabase()
    .selectDistinctOn([sceneAudioGenerations.sceneVersionId], {
      id: sceneAudioGenerations.id,
      sceneVersionId: sceneAudioGenerations.sceneVersionId,
      status: sceneAudioGenerations.status,
      reviewStatus: sceneAudioGenerations.reviewStatus,
      assetObjectKey: sceneAudioGenerations.assetObjectKey,
      durationMilliseconds: sceneAudioGenerations.durationMilliseconds,
      amplitudeEnvelope: sceneAudioGenerations.amplitudeEnvelope,
      safeErrorMessage: sceneAudioGenerations.safeErrorMessage,
      estimatedCostCents: sceneAudioGenerations.estimatedCostCents,
    })
    .from(sceneAudioGenerations)
    .where(
      and(
        eq(sceneAudioGenerations.workspaceId, input.workspaceId),
        eq(sceneAudioGenerations.projectId, input.projectId),
        inArray(sceneAudioGenerations.sceneVersionId, sceneVersionIds),
      ),
    )
    .orderBy(
      sceneAudioGenerations.sceneVersionId,
      sql`case when ${sceneAudioGenerations.reviewStatus} = 'approved' and ${sceneAudioGenerations.status} = 'succeeded' then 0 else 1 end`,
      desc(sceneAudioGenerations.generationVersion),
    );
}
