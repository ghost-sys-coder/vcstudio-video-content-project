import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  projectTitleSuggestions,
  titleGenerationRuns,
  usageReservations,
  type ContentPlatform,
  type ProjectTitleSuggestion,
  type TitleGenerationRun,
  type UsageReservation,
} from "@/db/schema";

export async function findTitleGenerationRun(input: {
  workspaceId: string;
  projectId: string;
  titleGenerationRunId: string;
}): Promise<TitleGenerationRun | null> {
  const [run] = await getDatabase()
    .select()
    .from(titleGenerationRuns)
    .where(
      and(
        eq(titleGenerationRuns.workspaceId, input.workspaceId),
        eq(titleGenerationRuns.projectId, input.projectId),
        eq(titleGenerationRuns.id, input.titleGenerationRunId),
      ),
    )
    .limit(1);
  return run ?? null;
}

export async function findTitleGenerationRunById(
  titleGenerationRunId: string,
): Promise<TitleGenerationRun | null> {
  const [run] = await getDatabase()
    .select()
    .from(titleGenerationRuns)
    .where(eq(titleGenerationRuns.id, titleGenerationRunId))
    .limit(1);
  return run ?? null;
}

export async function findTitleGenerationRunByIdempotencyKey(input: {
  workspaceId: string;
  idempotencyKey: string;
}): Promise<TitleGenerationRun | null> {
  const [run] = await getDatabase()
    .select()
    .from(titleGenerationRuns)
    .where(
      and(
        eq(titleGenerationRuns.workspaceId, input.workspaceId),
        eq(titleGenerationRuns.idempotencyKey, input.idempotencyKey),
      ),
    )
    .limit(1);
  return run ?? null;
}

export async function findTitleGenerationReservation(input: {
  workspaceId: string;
  titleGenerationRunId: string;
}): Promise<UsageReservation | null> {
  const [reservation] = await getDatabase()
    .select()
    .from(usageReservations)
    .where(
      and(
        eq(usageReservations.workspaceId, input.workspaceId),
        eq(usageReservations.titleGenerationId, input.titleGenerationRunId),
      ),
    )
    .limit(1);
  return reservation ?? null;
}

export async function findLatestTitleGenerationRunForPlatform(input: {
  workspaceId: string;
  projectId: string;
  platform: ContentPlatform;
}): Promise<TitleGenerationRun | null> {
  const [run] = await getDatabase()
    .select()
    .from(titleGenerationRuns)
    .where(
      and(
        eq(titleGenerationRuns.workspaceId, input.workspaceId),
        eq(titleGenerationRuns.projectId, input.projectId),
        eq(titleGenerationRuns.platform, input.platform),
      ),
    )
    .orderBy(desc(titleGenerationRuns.createdAt))
    .limit(1);
  return run ?? null;
}

export async function listProjectTitleSuggestions(input: {
  workspaceId: string;
  projectId: string;
}): Promise<ProjectTitleSuggestion[]> {
  return getDatabase()
    .select()
    .from(projectTitleSuggestions)
    .where(
      and(
        eq(projectTitleSuggestions.workspaceId, input.workspaceId),
        eq(projectTitleSuggestions.projectId, input.projectId),
      ),
    )
    .orderBy(
      desc(projectTitleSuggestions.createdAt),
      projectTitleSuggestions.position,
    );
}
