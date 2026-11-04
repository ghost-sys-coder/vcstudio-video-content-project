import "server-only";
import { and, asc, desc, eq, ilike, isNull, or, gte, lte } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { mediaAssets, scenes, sceneVersions, socialPosts } from "@/db/schema";
import { findLatestCompletedSceneAnalysisRun } from "@/db/repositories/scenes.repository";
export async function listMcpSceneWindow(input: {
  workspaceId: string;
  projectId: string;
  page: number;
  pageSize: number;
}) {
  const run = await findLatestCompletedSceneAnalysisRun(input);
  return getDatabase()
    .select({ scene: scenes, version: sceneVersions })
    .from(scenes)
    .innerJoin(
      sceneVersions,
      and(
        eq(sceneVersions.sceneId, scenes.id),
        eq(sceneVersions.workspaceId, input.workspaceId),
        eq(sceneVersions.versionNumber, scenes.currentVersion),
      ),
    )
    .where(
      and(
        eq(scenes.workspaceId, input.workspaceId),
        eq(scenes.projectId, input.projectId),
        run ? eq(scenes.analysisRunId, run.id) : isNull(scenes.analysisRunId),
      ),
    )
    .orderBy(asc(scenes.sceneNumber))
    .limit(input.pageSize + 1)
    .offset((input.page - 1) * input.pageSize);
}
export async function listMcpAssets(input: {
  workspaceId: string;
  page: number;
  pageSize: number;
  search?: string;
}) {
  return getDatabase()
    .select()
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.workspaceId, input.workspaceId),
        eq(mediaAssets.status, "ready"),
        isNull(mediaAssets.deletedAt),
        input.search
          ? or(
              ilike(mediaAssets.title, `%${input.search}%`),
              ilike(mediaAssets.originalFileName, `%${input.search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(mediaAssets.createdAt), desc(mediaAssets.id))
    .limit(input.pageSize + 1)
    .offset((input.page - 1) * input.pageSize);
}
export async function listMcpPosts(input: {
  workspaceId: string;
  page: number;
  pageSize: number;
  from?: Date;
  to?: Date;
}) {
  return getDatabase()
    .select({
      id: socialPosts.id,
      name: socialPosts.name,
      bodyPlainText: socialPosts.bodyPlainText,
      version: socialPosts.version,
      status: socialPosts.status,
      scheduledAt: socialPosts.scheduledAt,
      scheduledTimezone: socialPosts.scheduledTimezone,
    })
    .from(socialPosts)
    .where(
      and(
        eq(socialPosts.workspaceId, input.workspaceId),
        input.from ? gte(socialPosts.scheduledAt, input.from) : undefined,
        input.to ? lte(socialPosts.scheduledAt, input.to) : undefined,
      ),
    )
    .orderBy(desc(socialPosts.createdAt), desc(socialPosts.id))
    .limit(input.pageSize + 1)
    .offset((input.page - 1) * input.pageSize);
}
