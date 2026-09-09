import "server-only";

import { and, asc, count, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  channelProfiles,
  platformConnections,
  projects,
  type ChannelProfile,
  type PlatformConnection,
} from "@/db/schema";

export type ChannelProfileWithConnection = {
  profile: ChannelProfile;
  /**
   * The live grant for this channel, resolved by external account id rather
   * than a stored row reference. Null when the channel has never been
   * connected, or when its connection has been revoked or deleted — in which
   * case the profile and its projects are untouched.
   */
  connection: PlatformConnection | null;
};

/**
 * Attaches the current OAuth grant to each profile.
 *
 * The join is on (workspace, platform, external account id), never on a stored
 * connection id, so revoking and reconnecting leaves the production identity
 * intact and re-links automatically. A profile with no external account id
 * matches nothing, which is correct: it is planned but not yet connected.
 */
export async function listChannelProfiles(input: {
  workspaceId: string;
  includeArchived?: boolean;
}): Promise<ChannelProfileWithConnection[]> {
  const rows = await getDatabase()
    .select({ profile: channelProfiles, connection: platformConnections })
    .from(channelProfiles)
    .leftJoin(
      platformConnections,
      and(
        eq(platformConnections.workspaceId, channelProfiles.workspaceId),
        eq(platformConnections.platform, channelProfiles.platform),
        eq(
          platformConnections.externalAccountId,
          channelProfiles.externalAccountId,
        ),
      ),
    )
    .where(
      input.includeArchived
        ? eq(channelProfiles.workspaceId, input.workspaceId)
        : and(
            eq(channelProfiles.workspaceId, input.workspaceId),
            eq(channelProfiles.status, "active"),
          ),
    )
    .orderBy(asc(channelProfiles.name))
    .limit(200);
  return rows.map((row) => ({
    profile: row.profile,
    connection: row.connection ?? null,
  }));
}

export async function findChannelProfile(input: {
  workspaceId: string;
  channelProfileId: string;
}): Promise<ChannelProfileWithConnection | null> {
  const [row] = await getDatabase()
    .select({ profile: channelProfiles, connection: platformConnections })
    .from(channelProfiles)
    .leftJoin(
      platformConnections,
      and(
        eq(platformConnections.workspaceId, channelProfiles.workspaceId),
        eq(platformConnections.platform, channelProfiles.platform),
        eq(
          platformConnections.externalAccountId,
          channelProfiles.externalAccountId,
        ),
      ),
    )
    .where(
      and(
        eq(channelProfiles.workspaceId, input.workspaceId),
        eq(channelProfiles.id, input.channelProfileId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { profile: row.profile, connection: row.connection ?? null };
}

/** Projects produced for one channel, plus the unassigned backlog when asked. */
export async function listProjectsForChannel(input: {
  workspaceId: string;
  channelProfileId: string | null;
}) {
  return getDatabase()
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, input.workspaceId),
        input.channelProfileId === null
          ? isNull(projects.channelProfileId)
          : eq(projects.channelProfileId, input.channelProfileId),
      ),
    )
    .orderBy(asc(projects.name))
    .limit(500);
}

/**
 * Finds a profile already claiming an external account, so connecting a channel
 * twice updates one profile rather than silently creating a duplicate identity.
 */
export async function findChannelProfileByExternalAccount(input: {
  workspaceId: string;
  platform: PlatformConnection["platform"];
  externalAccountId: string;
}): Promise<ChannelProfile | null> {
  const [row] = await getDatabase()
    .select()
    .from(channelProfiles)
    .where(
      and(
        eq(channelProfiles.workspaceId, input.workspaceId),
        eq(channelProfiles.platform, input.platform),
        eq(channelProfiles.externalAccountId, input.externalAccountId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** True when the slug is free, or already belongs to the profile being edited. */
export async function isChannelSlugAvailable(input: {
  workspaceId: string;
  slug: string;
  excludeChannelProfileId?: string;
}): Promise<boolean> {
  const [row] = await getDatabase()
    .select({ id: channelProfiles.id })
    .from(channelProfiles)
    .where(
      and(
        eq(channelProfiles.workspaceId, input.workspaceId),
        eq(channelProfiles.slug, input.slug),
      ),
    )
    .limit(1);
  if (!row) return true;
  return row.id === input.excludeChannelProfileId;
}

/**
 * Project counts per channel in one grouped query, so a settings page listing
 * many channels does not fan out into a query each.
 */
export async function countProjectsByChannel(input: {
  workspaceId: string;
}): Promise<Map<string, number>> {
  const rows = await getDatabase()
    .select({ channelProfileId: projects.channelProfileId, total: count() })
    .from(projects)
    .where(eq(projects.workspaceId, input.workspaceId))
    .groupBy(projects.channelProfileId);
  const totals = new Map<string, number>();
  for (const row of rows)
    if (row.channelProfileId) totals.set(row.channelProfileId, row.total);
  return totals;
}
