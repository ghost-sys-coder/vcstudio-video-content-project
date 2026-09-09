import "server-only";

import { and, count, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  channelProfiles,
  projectScriptDrafts,
  projectScriptVersions,
  projects,
  sceneAudioGenerations,
  sceneImageGenerations,
  scenes,
  videoPublications,
  videoRenders,
} from "@/db/schema";
import { calculatePagination } from "@/lib/domain/pagination";
import {
  resolveProductionReadiness,
  type ProductionReadiness,
  type ProjectProductionFacts,
} from "@/lib/production/production-readiness";
import type { ProductionQueueQuery } from "@/lib/schemas/production-queue";

export interface ProductionQueueItem {
  projectId: string;
  name: string;
  /** The manual editorial status, shown as intent and never used as evidence. */
  editorialStatus: string;
  channelProfileId: string | null;
  channelName: string | null;
  plannedReleaseAt: Date | null;
  updatedAt: Date;
  readiness: ProductionReadiness;
}

export interface ProductionQueuePage {
  items: ProductionQueueItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * Counts scoped to one page of projects.
 *
 * Every aggregate below is filtered by both the workspace and the page's own
 * project ids, so the work stays proportional to the page rather than to the
 * workspace. Nothing here reads `projects.status`: readiness is derived from
 * these counts alone, and the manual status travels beside them as intent.
 */
async function loadPageFacts(input: {
  workspaceId: string;
  projectIds: string[];
  plannedReleaseByProject: Map<string, Date | null>;
}): Promise<Map<string, ProjectProductionFacts>> {
  const database = getDatabase();
  const { workspaceId, projectIds } = input;

  const [
    approvedScripts,
    drafts,
    sceneRows,
    imageRows,
    imagedScenes,
    audioRows,
    renderRows,
    publicationRows,
  ] = await Promise.all([
    database
      .selectDistinct({ projectId: projectScriptVersions.projectId })
      .from(projectScriptVersions)
      .where(
        and(
          eq(projectScriptVersions.workspaceId, workspaceId),
          eq(projectScriptVersions.status, "approved"),
          inArray(projectScriptVersions.projectId, projectIds),
        ),
      ),
    // Creating a project seeds an empty draft row, so the existence of a draft
    // proves nothing. Only a draft someone has actually written into counts as
    // work in progress, which is what separates "no script yet" from "written
    // but not approved".
    database
      .selectDistinct({ projectId: projectScriptDrafts.projectId })
      .from(projectScriptDrafts)
      .where(
        and(
          eq(projectScriptDrafts.workspaceId, workspaceId),
          gt(projectScriptDrafts.characterCount, 0),
          inArray(projectScriptDrafts.projectId, projectIds),
        ),
      ),
    database
      .select({
        projectId: scenes.projectId,
        total: sql<number>`cast(count(*) as int)`,
        awaitingReview: sql<number>`cast(count(*) filter (where ${scenes.status} = 'review') as int)`,
      })
      .from(scenes)
      .where(
        and(
          eq(scenes.workspaceId, workspaceId),
          inArray(scenes.projectId, projectIds),
        ),
      )
      .groupBy(scenes.projectId),
    database
      .select({
        projectId: sceneImageGenerations.projectId,
        succeeded: sql<number>`cast(count(*) filter (where ${sceneImageGenerations.status} = 'succeeded') as int)`,
        awaitingReview: sql<number>`cast(count(*) filter (where ${sceneImageGenerations.status} = 'succeeded' and ${sceneImageGenerations.reviewStatus} = 'pending') as int)`,
        failed: sql<number>`cast(count(*) filter (where ${sceneImageGenerations.status} = 'failed') as int)`,
      })
      .from(sceneImageGenerations)
      .where(
        and(
          eq(sceneImageGenerations.workspaceId, workspaceId),
          inArray(sceneImageGenerations.projectId, projectIds),
        ),
      )
      .groupBy(sceneImageGenerations.projectId),
    // Scenes that already have at least one succeeded image, so the shortfall
    // can be measured per scene rather than guessed from a raw image count.
    database
      .select({
        projectId: sceneImageGenerations.projectId,
        covered: sql<number>`cast(count(distinct ${sceneImageGenerations.sceneId}) as int)`,
      })
      .from(sceneImageGenerations)
      .where(
        and(
          eq(sceneImageGenerations.workspaceId, workspaceId),
          eq(sceneImageGenerations.status, "succeeded"),
          inArray(sceneImageGenerations.projectId, projectIds),
        ),
      )
      .groupBy(sceneImageGenerations.projectId),
    database
      .select({
        projectId: sceneAudioGenerations.projectId,
        succeeded: sql<number>`cast(count(*) filter (where ${sceneAudioGenerations.status} = 'succeeded') as int)`,
        awaitingReview: sql<number>`cast(count(*) filter (where ${sceneAudioGenerations.status} = 'succeeded' and ${sceneAudioGenerations.reviewStatus} = 'pending') as int)`,
        failed: sql<number>`cast(count(*) filter (where ${sceneAudioGenerations.status} = 'failed') as int)`,
      })
      .from(sceneAudioGenerations)
      .where(
        and(
          eq(sceneAudioGenerations.workspaceId, workspaceId),
          inArray(sceneAudioGenerations.projectId, projectIds),
        ),
      )
      .groupBy(sceneAudioGenerations.projectId),
    database
      .select({
        projectId: videoRenders.projectId,
        succeeded: sql<number>`cast(count(*) filter (where ${videoRenders.status} = 'succeeded') as int)`,
        failed: sql<number>`cast(count(*) filter (where ${videoRenders.status} = 'failed') as int)`,
        inFlight: sql<number>`cast(count(*) filter (where ${videoRenders.status} in ('pending', 'queued', 'running')) as int)`,
      })
      .from(videoRenders)
      .where(
        and(
          eq(videoRenders.workspaceId, workspaceId),
          inArray(videoRenders.projectId, projectIds),
        ),
      )
      .groupBy(videoRenders.projectId),
    database
      .select({
        projectId: videoPublications.projectId,
        succeeded: sql<number>`cast(count(*) filter (where ${videoPublications.status} = 'succeeded') as int)`,
        failed: sql<number>`cast(count(*) filter (where ${videoPublications.status} = 'failed') as int)`,
      })
      .from(videoPublications)
      .where(
        and(
          eq(videoPublications.workspaceId, workspaceId),
          inArray(videoPublications.projectId, projectIds),
        ),
      )
      .groupBy(videoPublications.projectId),
  ]);

  const approved = new Set(approvedScripts.map((row) => row.projectId));
  const drafted = new Set(drafts.map((row) => row.projectId));
  const byProject = <T extends { projectId: string }>(rows: T[]) =>
    new Map(rows.map((row) => [row.projectId, row]));
  const sceneBy = byProject(sceneRows);
  const imageBy = byProject(imageRows);
  const coveredBy = byProject(imagedScenes);
  const audioBy = byProject(audioRows);
  const renderBy = byProject(renderRows);
  const publicationBy = byProject(publicationRows);

  return new Map(
    projectIds.map((projectId) => {
      const sceneCount = sceneBy.get(projectId)?.total ?? 0;
      const covered = coveredBy.get(projectId)?.covered ?? 0;
      return [
        projectId,
        {
          projectId,
          hasApprovedScript: approved.has(projectId),
          hasScriptDraft: drafted.has(projectId),
          sceneCount,
          scenesAwaitingReview: sceneBy.get(projectId)?.awaitingReview ?? 0,
          imagesSucceeded: imageBy.get(projectId)?.succeeded ?? 0,
          imagesAwaitingReview: imageBy.get(projectId)?.awaitingReview ?? 0,
          imagesFailed: imageBy.get(projectId)?.failed ?? 0,
          scenesWithoutApprovedImage: Math.max(0, sceneCount - covered),
          audioSucceeded: audioBy.get(projectId)?.succeeded ?? 0,
          audioAwaitingReview: audioBy.get(projectId)?.awaitingReview ?? 0,
          audioFailed: audioBy.get(projectId)?.failed ?? 0,
          rendersSucceeded: renderBy.get(projectId)?.succeeded ?? 0,
          rendersFailed: renderBy.get(projectId)?.failed ?? 0,
          rendersInFlight: renderBy.get(projectId)?.inFlight ?? 0,
          publicationsSucceeded: publicationBy.get(projectId)?.succeeded ?? 0,
          publicationsFailed: publicationBy.get(projectId)?.failed ?? 0,
          plannedReleaseAt:
            input.plannedReleaseByProject.get(projectId) ?? null,
        } satisfies ProjectProductionFacts,
      ];
    }),
  );
}

/**
 * One page of the production queue.
 *
 * Release and attention filters are applied after readiness is derived, since
 * both are computed rather than stored. The page itself is always bounded by
 * the database, so that post-filtering can only ever shrink a bounded set.
 */
export async function loadProductionQueue(input: {
  workspaceId: string;
  query: ProductionQueueQuery;
}): Promise<ProductionQueuePage> {
  const database = getDatabase();
  const { workspaceId, query } = input;
  const conditions = [eq(projects.workspaceId, workspaceId)];
  if (!query.includeArchived)
    conditions.push(sql`${projects.archivedAt} is null`);
  if (query.channelProfileId)
    conditions.push(eq(projects.channelProfileId, query.channelProfileId));
  if (query.release === "scheduled")
    conditions.push(isNotNull(projects.plannedReleaseAt));
  const where = and(...conditions);
  const offset = calculatePagination({ ...query, total: 0 }).offset;

  const [rows, totals] = await Promise.all([
    database
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        channelProfileId: projects.channelProfileId,
        channelName: channelProfiles.name,
        plannedReleaseAt: projects.plannedReleaseAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .leftJoin(
        channelProfiles,
        and(
          eq(channelProfiles.id, projects.channelProfileId),
          eq(channelProfiles.workspaceId, projects.workspaceId),
        ),
      )
      .where(where)
      // Planned releases first and soonest, then the most recently touched.
      // Written as one SQL term because the null placement has to follow the
      // direction: "asc nulls last", not "nulls last asc".
      .orderBy(
        sql`${projects.plannedReleaseAt} asc nulls last`,
        desc(projects.updatedAt),
        desc(projects.id),
      )
      .limit(query.pageSize)
      .offset(offset),
    database.select({ value: count() }).from(projects).where(where),
  ]);

  const total = totals[0]?.value ?? 0;
  const projectIds = rows.map((row) => row.id);
  const factsByProject =
    projectIds.length === 0
      ? new Map<string, ProjectProductionFacts>()
      : await loadPageFacts({
          workspaceId,
          projectIds,
          plannedReleaseByProject: new Map(
            rows.map((row) => [row.id, row.plannedReleaseAt]),
          ),
        });

  const items = rows.flatMap((row) => {
    const facts = factsByProject.get(row.id);
    if (!facts) return [];
    const readiness = resolveProductionReadiness(facts);
    if (query.release !== "all" && readiness.releaseState !== query.release)
      return [];
    if (
      query.attention === "blocked" &&
      !readiness.blockers.some((entry) => entry.severity === "blocking")
    )
      return [];
    if (query.attention === "awaiting_review" && readiness.reviews.length === 0)
      return [];
    return [
      {
        projectId: row.id,
        name: row.name,
        editorialStatus: row.status,
        channelProfileId: row.channelProfileId,
        channelName: row.channelName,
        plannedReleaseAt: row.plannedReleaseAt,
        updatedAt: row.updatedAt,
        readiness,
      } satisfies ProductionQueueItem,
    ];
  });

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: calculatePagination({ ...query, total }).pageCount,
  };
}
