import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  scriptGenerationRuns,
  usageReservations,
  type ScriptGenerationRun,
  type UsageReservation,
} from "@/db/schema";

export async function findScriptGenerationRun(input: {
  workspaceId: string;
  projectId: string;
  scriptGenerationRunId: string;
}): Promise<ScriptGenerationRun | null> {
  const [run] = await getDatabase()
    .select()
    .from(scriptGenerationRuns)
    .where(
      and(
        eq(scriptGenerationRuns.workspaceId, input.workspaceId),
        eq(scriptGenerationRuns.projectId, input.projectId),
        eq(scriptGenerationRuns.id, input.scriptGenerationRunId),
      ),
    )
    .limit(1);
  return run ?? null;
}

export async function findScriptGenerationRunById(
  scriptGenerationRunId: string,
): Promise<ScriptGenerationRun | null> {
  const [run] = await getDatabase()
    .select()
    .from(scriptGenerationRuns)
    .where(eq(scriptGenerationRuns.id, scriptGenerationRunId))
    .limit(1);
  return run ?? null;
}

export async function findScriptGenerationRunByIdempotencyKey(input: {
  workspaceId: string;
  idempotencyKey: string;
}): Promise<ScriptGenerationRun | null> {
  const [run] = await getDatabase()
    .select()
    .from(scriptGenerationRuns)
    .where(
      and(
        eq(scriptGenerationRuns.workspaceId, input.workspaceId),
        eq(scriptGenerationRuns.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  return run ?? null;
}

export async function findScriptGenerationReservation(input: {
  workspaceId: string;
  scriptGenerationRunId: string;
}): Promise<UsageReservation | null> {
  const [reservation] = await getDatabase()
    .select()
    .from(usageReservations)
    .where(
      and(
        eq(usageReservations.workspaceId, input.workspaceId),
        eq(usageReservations.scriptGenerationId, input.scriptGenerationRunId),
      ),
    )
    .limit(1);
  return reservation ?? null;
}

export async function findLatestScriptGenerationRun(input: {
  workspaceId: string;
  projectId: string;
}): Promise<ScriptGenerationRun | null> {
  const [run] = await getDatabase()
    .select()
    .from(scriptGenerationRuns)
    .where(
      and(
        eq(scriptGenerationRuns.workspaceId, input.workspaceId),
        eq(scriptGenerationRuns.projectId, input.projectId),
      ),
    )
    .orderBy(desc(scriptGenerationRuns.createdAt))
    .limit(1);
  return run ?? null;
}
