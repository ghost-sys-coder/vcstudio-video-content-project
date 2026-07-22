import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  platformConnections,
  videoPublications,
  type ContentPlatform,
  type PlatformConnection,
  type VideoPublication,
} from "@/db/schema";

/**
 * Columns safe to project into a view model. Deliberately excludes the sealed
 * token columns so a connection can never reach a React component with a
 * credential attached, even a sealed one.
 */
const connectionSummaryColumns = {
  id: platformConnections.id,
  workspaceId: platformConnections.workspaceId,
  platform: platformConnections.platform,
  externalAccountId: platformConnections.externalAccountId,
  externalAccountName: platformConnections.externalAccountName,
  externalAccountUrl: platformConnections.externalAccountUrl,
  status: platformConnections.status,
  lastError: platformConnections.lastError,
  accessTokenExpiresAt: platformConnections.accessTokenExpiresAt,
  createdAt: platformConnections.createdAt,
  updatedAt: platformConnections.updatedAt,
};

export type PlatformConnectionSummary = {
  id: string;
  workspaceId: string;
  platform: ContentPlatform;
  externalAccountId: string;
  externalAccountName: string;
  externalAccountUrl: string | null;
  status: PlatformConnection["status"];
  lastError: string | null;
  accessTokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function listPlatformConnections(input: {
  workspaceId: string;
}): Promise<PlatformConnectionSummary[]> {
  return getDatabase()
    .select(connectionSummaryColumns)
    .from(platformConnections)
    .where(eq(platformConnections.workspaceId, input.workspaceId))
    .orderBy(desc(platformConnections.updatedAt));
}

export async function findActivePlatformConnection(input: {
  workspaceId: string;
  platform: ContentPlatform;
}): Promise<PlatformConnectionSummary | null> {
  const [connection] = await getDatabase()
    .select(connectionSummaryColumns)
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.workspaceId, input.workspaceId),
        eq(platformConnections.platform, input.platform),
        eq(platformConnections.status, "active"),
      ),
    )
    .orderBy(desc(platformConnections.updatedAt))
    .limit(1);
  return connection ?? null;
}

/** Exact token-free connection lookup for validating a user-selected account. */
export async function findPlatformConnectionSummary(input: {
  connectionId: string;
  workspaceId: string;
}): Promise<PlatformConnectionSummary | null> {
  const [connection] = await getDatabase()
    .select(connectionSummaryColumns)
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.id, input.connectionId),
        eq(platformConnections.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  return connection ?? null;
}

/**
 * Full row including sealed tokens. Server-only and used exclusively by the
 * publish worker — never call this from a view model or server action.
 */
export async function findPlatformConnectionWithTokens(input: {
  connectionId: string;
  workspaceId: string;
}): Promise<PlatformConnection | null> {
  const [connection] = await getDatabase()
    .select()
    .from(platformConnections)
    .where(
      and(
        eq(platformConnections.id, input.connectionId),
        eq(platformConnections.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  return connection ?? null;
}

export async function findVideoPublication(input: {
  workspaceId: string;
  projectId: string;
  publicationId: string;
}): Promise<VideoPublication | null> {
  const [publication] = await getDatabase()
    .select()
    .from(videoPublications)
    .where(
      and(
        eq(videoPublications.id, input.publicationId),
        eq(videoPublications.workspaceId, input.workspaceId),
        eq(videoPublications.projectId, input.projectId),
      ),
    )
    .limit(1);
  return publication ?? null;
}

export async function findVideoPublicationById(
  publicationId: string,
): Promise<VideoPublication | null> {
  const [publication] = await getDatabase()
    .select()
    .from(videoPublications)
    .where(eq(videoPublications.id, publicationId))
    .limit(1);
  return publication ?? null;
}

export async function findVideoPublicationByIdempotencyKey(
  idempotencyKey: string,
): Promise<VideoPublication | null> {
  const [publication] = await getDatabase()
    .select()
    .from(videoPublications)
    .where(eq(videoPublications.idempotencyKey, idempotencyKey))
    .limit(1);
  return publication ?? null;
}

export async function listProjectVideoPublications(input: {
  workspaceId: string;
  projectId: string;
  limit: number;
}): Promise<VideoPublication[]> {
  return getDatabase()
    .select()
    .from(videoPublications)
    .where(
      and(
        eq(videoPublications.workspaceId, input.workspaceId),
        eq(videoPublications.projectId, input.projectId),
      ),
    )
    .orderBy(desc(videoPublications.createdAt))
    .limit(input.limit);
}

/** Blocks a duplicate upload of the same render to the same account. */
export async function countActivePublicationsForRender(input: {
  workspaceId: string;
  renderId: string;
  connectionId: string;
}): Promise<number> {
  const rows = await getDatabase()
    .select({ id: videoPublications.id })
    .from(videoPublications)
    .where(
      and(
        eq(videoPublications.workspaceId, input.workspaceId),
        eq(videoPublications.renderId, input.renderId),
        eq(videoPublications.connectionId, input.connectionId),
        inArray(videoPublications.status, [
          "pending",
          "queued",
          "uploading",
          "processing",
          "succeeded",
        ]),
      ),
    );
  return rows.length;
}
