import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  publicationFinishingSteps,
  type PublicationFinishingStep,
} from "@/db/schema";
import type {
  FinishingStepState,
  YouTubeFinishingStep,
} from "@/lib/publishing/youtube-finishing-steps";

/**
 * Records how one finishing step ended.
 *
 * Upserted on the publication and step, because a step is a state rather than
 * an event log: retrying a failed thumbnail should update the one row, not
 * accumulate a history nobody reads. `completedAt` is set for every settled
 * state, which the table's own check constraint requires — a settled step with
 * no completion time would be a state the database cannot describe.
 */
export async function recordFinishingStep(input: {
  workspaceId: string;
  publicationId: string;
  step: YouTubeFinishingStep;
  state: FinishingStepState;
  detail: string | null;
}): Promise<void> {
  const settled = input.state !== "pending";
  await getDatabase()
    .insert(publicationFinishingSteps)
    .values({
      workspaceId: input.workspaceId,
      publicationId: input.publicationId,
      step: input.step,
      state: input.state,
      detail: input.detail,
      attemptCount: settled ? 1 : 0,
      completedAt: settled ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [
        publicationFinishingSteps.publicationId,
        publicationFinishingSteps.step,
      ],
      set: {
        state: input.state,
        detail: input.detail,
        attemptCount: settled
          ? sql`${publicationFinishingSteps.attemptCount} + 1`
          : publicationFinishingSteps.attemptCount,
        completedAt: settled ? new Date() : null,
        updatedAt: new Date(),
      },
    });
}

/**
 * Marks the steps a release will attempt, before any of them runs.
 *
 * Writing them up front is what makes an interrupted worker visible: a step
 * left `pending` says the release never finished, where an absent row would be
 * indistinguishable from a release that had nothing to do.
 */
export async function initialiseFinishingSteps(input: {
  workspaceId: string;
  publicationId: string;
  steps: readonly YouTubeFinishingStep[];
}): Promise<void> {
  if (input.steps.length === 0) return;
  await getDatabase()
    .insert(publicationFinishingSteps)
    .values(
      input.steps.map((step) => ({
        workspaceId: input.workspaceId,
        publicationId: input.publicationId,
        step,
        state: "pending" as const,
        detail: null,
        attemptCount: 0,
        completedAt: null,
      })),
    )
    .onConflictDoNothing({
      target: [
        publicationFinishingSteps.publicationId,
        publicationFinishingSteps.step,
      ],
    });
}

/** One publication's finishing steps, scoped by workspace. */
export async function listFinishingSteps(input: {
  workspaceId: string;
  publicationId: string;
}): Promise<PublicationFinishingStep[]> {
  return getDatabase()
    .select()
    .from(publicationFinishingSteps)
    .where(
      and(
        eq(publicationFinishingSteps.workspaceId, input.workspaceId),
        eq(publicationFinishingSteps.publicationId, input.publicationId),
      ),
    );
}

/**
 * The finishing steps for several publications at once.
 *
 * One query rather than one per publication: the publish page shows a bounded
 * page of history, and asking per row would turn that into a query count that
 * grows with it.
 */
export async function listFinishingStepsForPublications(input: {
  workspaceId: string;
  publicationIds: readonly string[];
}): Promise<PublicationFinishingStep[]> {
  if (input.publicationIds.length === 0) return [];
  return getDatabase()
    .select()
    .from(publicationFinishingSteps)
    .where(
      and(
        eq(publicationFinishingSteps.workspaceId, input.workspaceId),
        inArray(publicationFinishingSteps.publicationId, [
          ...input.publicationIds,
        ]),
      ),
    );
}
