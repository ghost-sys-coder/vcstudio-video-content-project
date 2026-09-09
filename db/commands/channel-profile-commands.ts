import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import { channelProfiles, projects } from "@/db/schema";
import type { ChannelProfileInput } from "@/lib/schemas/channel-profile";
import { createChannelProfileSlug } from "@/lib/schemas/channel-profile";

export class ChannelProfileNotFoundError extends Error {
  readonly code = "CHANNEL_PROFILE_NOT_FOUND";

  constructor() {
    super("This channel is unavailable.");
    this.name = "ChannelProfileNotFoundError";
  }
}

export class ChannelProfileSlugTakenError extends Error {
  readonly code = "CHANNEL_PROFILE_SLUG_TAKEN";

  constructor() {
    super("Another channel in this workspace already uses that name.");
    this.name = "ChannelProfileSlugTakenError";
  }
}

/**
 * Appends a numeric suffix until the per-workspace slug is free.
 *
 * Two channels can legitimately share a display name ("Shorts" on two brands),
 * so a collision must not be an error the creator has to solve by renaming.
 */
async function claimSlug(input: {
  workspaceId: string;
  name: string;
  excludeChannelProfileId?: string;
}): Promise<string> {
  const base = createChannelProfileSlug(input.name);
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}-${suffix + 1}`;
    const [existing] = await getDatabase()
      .select({ id: channelProfiles.id })
      .from(channelProfiles)
      .where(
        and(
          eq(channelProfiles.workspaceId, input.workspaceId),
          eq(channelProfiles.slug, candidate),
        ),
      )
      .limit(1);
    if (!existing || existing.id === input.excludeChannelProfileId)
      return candidate;
  }
  throw new ChannelProfileSlugTakenError();
}

export async function createChannelProfile(input: {
  workspaceId: string;
  createdByUserId: string;
  values: ChannelProfileInput;
}) {
  const slug = await claimSlug({
    workspaceId: input.workspaceId,
    name: input.values.name,
  });
  const [created] = await getDatabase()
    .insert(channelProfiles)
    .values({
      workspaceId: input.workspaceId,
      createdByUserId: input.createdByUserId,
      slug,
      name: input.values.name,
      platform: input.values.platform,
      description: input.values.description,
      audienceDescription: input.values.audienceDescription,
      toneDescription: input.values.toneDescription,
      language: input.values.language,
      cadence: input.values.cadence,
      timeZone: input.values.timeZone,
      defaultAspectRatio: input.values.defaultAspectRatio,
      defaultMaximumBudgetCents: input.values.defaultMaximumBudgetCents,
      externalAccountId: input.values.externalAccountId,
    })
    .returning();
  if (!created) throw new Error("CHANNEL_PROFILE_CREATE_FAILED");
  return created;
}

export async function updateChannelProfile(input: {
  workspaceId: string;
  channelProfileId: string;
  values: ChannelProfileInput;
}) {
  const slug = await claimSlug({
    workspaceId: input.workspaceId,
    name: input.values.name,
    excludeChannelProfileId: input.channelProfileId,
  });
  const [updated] = await getDatabase()
    .update(channelProfiles)
    .set({
      slug,
      name: input.values.name,
      platform: input.values.platform,
      description: input.values.description,
      audienceDescription: input.values.audienceDescription,
      toneDescription: input.values.toneDescription,
      language: input.values.language,
      cadence: input.values.cadence,
      timeZone: input.values.timeZone,
      defaultAspectRatio: input.values.defaultAspectRatio,
      defaultMaximumBudgetCents: input.values.defaultMaximumBudgetCents,
      externalAccountId: input.values.externalAccountId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(channelProfiles.workspaceId, input.workspaceId),
        eq(channelProfiles.id, input.channelProfileId),
        eq(channelProfiles.status, "active"),
      ),
    )
    .returning();
  if (!updated) throw new ChannelProfileNotFoundError();
  return updated;
}

/**
 * Archives rather than deletes.
 *
 * There is deliberately no delete command: `projects.channel_profile_id`
 * cascades, so deleting a profile would take its projects and their entire
 * production history with it. Archiving keeps the identity and the history and
 * simply removes the channel from selection lists.
 */
export async function archiveChannelProfile(input: {
  workspaceId: string;
  channelProfileId: string;
}) {
  const now = new Date();
  const [archived] = await getDatabase()
    .update(channelProfiles)
    .set({ status: "archived", archivedAt: now, updatedAt: now })
    .where(
      and(
        eq(channelProfiles.workspaceId, input.workspaceId),
        eq(channelProfiles.id, input.channelProfileId),
        eq(channelProfiles.status, "active"),
      ),
    )
    .returning();
  if (!archived) throw new ChannelProfileNotFoundError();
  return archived;
}

/**
 * Assigns a project to a channel, or clears the assignment when null.
 *
 * The profile lookup and the project update are both scoped to the workspace,
 * and the composite foreign key refuses a cross-workspace pairing even if this
 * check were bypassed. A project may always return to unassigned, which is what
 * keeps pre-channel projects usable.
 */
export async function assignProjectChannel(input: {
  workspaceId: string;
  projectId: string;
  channelProfileId: string | null;
}) {
  if (input.channelProfileId !== null) {
    const [profile] = await getDatabase()
      .select({ id: channelProfiles.id })
      .from(channelProfiles)
      .where(
        and(
          eq(channelProfiles.workspaceId, input.workspaceId),
          eq(channelProfiles.id, input.channelProfileId),
          eq(channelProfiles.status, "active"),
        ),
      )
      .limit(1);
    if (!profile) throw new ChannelProfileNotFoundError();
  }
  const [updated] = await getDatabase()
    .update(projects)
    .set({ channelProfileId: input.channelProfileId, updatedAt: new Date() })
    .where(
      and(
        eq(projects.workspaceId, input.workspaceId),
        eq(projects.id, input.projectId),
        sql`${projects.archivedAt} is null`,
      ),
    )
    .returning();
  if (!updated) throw new ChannelProfileNotFoundError();
  return updated;
}
