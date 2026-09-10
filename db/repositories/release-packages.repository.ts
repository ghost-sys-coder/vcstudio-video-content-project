import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  channelProfiles,
  releasePackages,
  thumbnailGenerations,
  videoRenders,
  type ReleasePackage,
} from "@/db/schema";

export interface ReleasePackageRow {
  package: ReleasePackage;
  /** The destination channel's name, when a profile is chosen. */
  channelName: string | null;
  /**
   * Whether the explicitly chosen thumbnail is still usable. False when one was
   * chosen and has since been deleted, which makes the package stale.
   */
  thumbnailAvailable: boolean;
}

/**
 * Every release package for one project.
 *
 * Bounded by the project: a project has one package per output, Short and
 * destination, which is a handful of rows, not a collection needing pagination.
 * Both the tenant and the project are in the predicate, never the id alone.
 */
export async function listReleasePackagesForProject(input: {
  workspaceId: string;
  projectId: string;
}): Promise<ReleasePackageRow[]> {
  const rows = await getDatabase()
    .select({
      package: releasePackages,
      channelName: channelProfiles.name,
      thumbnailStatus: thumbnailGenerations.status,
      thumbnailDismissedAt: thumbnailGenerations.dismissedAt,
      thumbnailAssetObjectKey: thumbnailGenerations.assetObjectKey,
    })
    .from(releasePackages)
    .leftJoin(
      channelProfiles,
      and(
        eq(channelProfiles.id, releasePackages.channelProfileId),
        eq(channelProfiles.workspaceId, releasePackages.workspaceId),
      ),
    )
    .leftJoin(
      thumbnailGenerations,
      and(
        eq(thumbnailGenerations.id, releasePackages.thumbnailGenerationId),
        eq(thumbnailGenerations.workspaceId, releasePackages.workspaceId),
      ),
    )
    .where(
      and(
        eq(releasePackages.workspaceId, input.workspaceId),
        eq(releasePackages.projectId, input.projectId),
      ),
    )
    .orderBy(releasePackages.platform, desc(releasePackages.updatedAt));

  return rows.map((row) => ({
    package: row.package,
    channelName: row.channelName ?? null,
    // A deleted thumbnail is dismissed rather than removed, so the foreign key
    // stays intact and the row has to be inspected to know it is gone.
    thumbnailAvailable:
      row.package.thumbnailGenerationId !== null &&
      row.thumbnailStatus === "succeeded" &&
      row.thumbnailDismissedAt === null &&
      row.thumbnailAssetObjectKey !== null,
  }));
}

export interface LatestRenderForTarget {
  outputVariantId: string;
  shortCompositionId: string | null;
  renderId: string;
  completedAt: Date | null;
}

/**
 * The newest succeeded render for each output and Short in a project.
 *
 * This is what makes a package stale: a package is confirmed against one exact
 * render, so a newer one means the source content moved underneath the
 * packaging. DISTINCT ON keeps it to one row per target in a single bounded
 * query rather than a query per package.
 */
export async function listLatestSucceededRendersForProject(input: {
  workspaceId: string;
  projectId: string;
}): Promise<LatestRenderForTarget[]> {
  const rows = await getDatabase()
    .selectDistinctOn(
      [videoRenders.outputVariantId, videoRenders.shortCompositionId],
      {
        outputVariantId: videoRenders.outputVariantId,
        shortCompositionId: videoRenders.shortCompositionId,
        renderId: videoRenders.id,
        completedAt: videoRenders.completedAt,
      },
    )
    .from(videoRenders)
    .where(
      and(
        eq(videoRenders.workspaceId, input.workspaceId),
        eq(videoRenders.projectId, input.projectId),
        eq(videoRenders.status, "succeeded"),
        sql`${videoRenders.assetObjectKey} is not null`,
      ),
    )
    .orderBy(
      videoRenders.outputVariantId,
      videoRenders.shortCompositionId,
      // Newest first within each target, so DISTINCT ON keeps the current one.
      sql`${videoRenders.completedAt} desc nulls last`,
      desc(videoRenders.createdAt),
    );

  return rows
    .filter(
      (row): row is LatestRenderForTarget & { outputVariantId: string } =>
        row.outputVariantId !== null,
    )
    .map((row) => ({
      outputVariantId: row.outputVariantId,
      shortCompositionId: row.shortCompositionId,
      renderId: row.renderId,
      completedAt: row.completedAt,
    }));
}

/** One package, scoped to its tenant and project. */
export async function findReleasePackage(input: {
  workspaceId: string;
  projectId: string;
  releasePackageId: string;
}): Promise<ReleasePackage | null> {
  const [row] = await getDatabase()
    .select()
    .from(releasePackages)
    .where(
      and(
        eq(releasePackages.id, input.releasePackageId),
        eq(releasePackages.workspaceId, input.workspaceId),
        eq(releasePackages.projectId, input.projectId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Packages that have never been given a channel, for the unassigned case. */
export async function countUnassignedReleasePackages(input: {
  workspaceId: string;
  projectId: string;
}): Promise<number> {
  const [row] = await getDatabase()
    .select({ total: sql<number>`count(*)::int` })
    .from(releasePackages)
    .where(
      and(
        eq(releasePackages.workspaceId, input.workspaceId),
        eq(releasePackages.projectId, input.projectId),
        isNull(releasePackages.channelProfileId),
      ),
    );
  return row?.total ?? 0;
}
