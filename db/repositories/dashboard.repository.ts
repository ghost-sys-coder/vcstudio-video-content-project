import "server-only";

import { eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { characters, projects, sceneImageGenerations } from "@/db/schema";
import { getWorkspaceUsageSummary } from "@/db/repositories/usage-summary.repository";

export type WorkspaceDashboardStatistics = {
  projects: { total: number; active: number };
  characters: { total: number };
  sceneImages: { succeeded: number; awaitingReview: number };
  /**
   * Month-to-date spend across **every** billable operation, not scene images
   * alone. This previously summed only `scene_image_generations.actual_cost_cents`
   * while being presented as overall spend, which understated production cost by
   * everything else on the ledger: script and scene analysis, narration audio,
   * renders, titles and thumbnails. It now reuses the usage read model, so the
   * number matches the Usage page instead of contradicting it.
   */
  spend: { monthToDateCents: number; coversAllOperations: true };
};

export async function getWorkspaceDashboardStatistics(input: {
  workspaceId: string;
  now?: Date;
}): Promise<WorkspaceDashboardStatistics> {
  const database = getDatabase();
  const [projectRows, characterRows, imageRows, usage] = await Promise.all([
    database
      .select({
        total: sql<number>`cast(count(*) filter (where ${projects.status} <> 'archived') as int)`,
        active: sql<number>`cast(count(*) filter (where ${projects.status} in ('planning', 'assetGeneration', 'review', 'readyToRender', 'rendering')) as int)`,
      })
      .from(projects)
      .where(eq(projects.workspaceId, input.workspaceId)),
    database
      .select({
        total: sql<number>`cast(count(*) filter (where ${characters.status} <> 'archived') as int)`,
      })
      .from(characters)
      .where(eq(characters.workspaceId, input.workspaceId)),
    database
      .select({
        succeeded: sql<number>`cast(count(*) filter (where ${sceneImageGenerations.status} = 'succeeded') as int)`,
        awaitingReview: sql<number>`cast(count(*) filter (where ${sceneImageGenerations.status} = 'succeeded' and ${sceneImageGenerations.reviewStatus} = 'pending') as int)`,
      })
      .from(sceneImageGenerations)
      .where(eq(sceneImageGenerations.workspaceId, input.workspaceId)),
    // The authoritative spend read model, shared with the Usage page.
    getWorkspaceUsageSummary({
      workspaceId: input.workspaceId,
      now: input.now,
      projectLimit: 1,
    }),
  ]);

  const projectStats = projectRows[0];
  const characterStats = characterRows[0];
  const imageStats = imageRows[0];

  return {
    projects: {
      total: Number(projectStats?.total ?? 0),
      active: Number(projectStats?.active ?? 0),
    },
    characters: {
      total: Number(characterStats?.total ?? 0),
    },
    sceneImages: {
      succeeded: Number(imageStats?.succeeded ?? 0),
      awaitingReview: Number(imageStats?.awaitingReview ?? 0),
    },
    spend: {
      monthToDateCents: usage.monthToDateCents,
      coversAllOperations: true,
    },
  };
}
