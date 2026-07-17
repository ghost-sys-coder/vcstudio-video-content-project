import "server-only";

import { eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { characters, projects, sceneImageGenerations } from "@/db/schema";

export type WorkspaceDashboardStatistics = {
  projects: { total: number; active: number };
  characters: { total: number };
  sceneImages: { succeeded: number; awaitingReview: number };
  spend: { monthToDateCents: number };
};

function getUtcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getWorkspaceDashboardStatistics(input: {
  workspaceId: string;
  now?: Date;
}): Promise<WorkspaceDashboardStatistics> {
  const database = getDatabase();
  const monthStart = getUtcMonthStart(input.now ?? new Date());

  const [projectRows, characterRows, imageRows] = await Promise.all([
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
        monthToDateCents: sql<number>`cast(coalesce(sum(${sceneImageGenerations.actualCostCents}) filter (where ${sceneImageGenerations.status} = 'succeeded' and ${sceneImageGenerations.createdAt} >= ${monthStart.toISOString()}), 0) as int)`,
      })
      .from(sceneImageGenerations)
      .where(eq(sceneImageGenerations.workspaceId, input.workspaceId)),
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
      monthToDateCents: Number(imageStats?.monthToDateCents ?? 0),
    },
  };
}
