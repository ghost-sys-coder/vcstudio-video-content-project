import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  archiveChannelProfile,
  assignProjectChannel,
  ChannelProfileNotFoundError,
  createChannelProfile,
  updateChannelProfile,
} from "@/db/commands/channel-profile-commands";
import {
  findChannelProfile,
  listChannelProfiles,
  listProjectsForChannel,
} from "@/db/repositories/channel-profiles.repository";
import { getDatabase } from "@/db/drizzle";
import {
  platformConnections,
  projects,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { resolveChannelPublishAvailability } from "@/lib/channels/channel-availability";
import type { ChannelProfileInput } from "@/lib/schemas/channel-profile";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;

const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();

type Fixture = { userId: string; workspaceId: string };

function channelValues(
  overrides: Partial<ChannelProfileInput> = {},
): ChannelProfileInput {
  return {
    name: "Money Made Clear",
    platform: "youtube",
    description: "",
    audienceDescription: "",
    toneDescription: "",
    language: "en-US",
    cadence: "weekly",
    timeZone: "Europe/London",
    defaultAspectRatio: null,
    defaultMaximumBudgetCents: null,
    externalAccountId: null,
    ...overrides,
  };
}

async function createFixture(): Promise<Fixture> {
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const label = randomUUID();
  fixtureUserIds.add(userId);
  fixtureWorkspaceIds.add(workspaceId);
  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `channel-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Channel Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Channel Workspace",
      slug: `channel-${label}`,
      createdByUserId: userId,
    }),
    database.insert(workspaceMembers).values({
      id: randomUUID(),
      workspaceId,
      userId,
      role: "owner",
    }),
  ]);
  return { userId, workspaceId };
}

async function createProject(fixture: Fixture, name: string) {
  const projectId = randomUUID();
  await getDatabase().insert(projects).values({
    id: projectId,
    workspaceId: fixture.workspaceId,
    name,
    status: "planning",
    aspectRatio: "16:9",
    width: 1920,
    height: 1080,
    framesPerSecond: 30,
    language: "en",
    maximumBudgetCents: 10_000,
    createdByUserId: fixture.userId,
  });
  return projectId;
}

async function connectAccount(fixture: Fixture, externalAccountId: string) {
  const connectionId = randomUUID();
  await getDatabase().insert(platformConnections).values({
    id: connectionId,
    workspaceId: fixture.workspaceId,
    platform: "youtube",
    externalAccountId,
    externalAccountName: "Test Channel",
    accessTokenSealed: "sealed",
    scopes: "youtube.upload",
    status: "active",
    connectedByUserId: fixture.userId,
  });
  return connectionId;
}

async function cleanup(): Promise<void> {
  const database = getDatabase();
  if (fixtureWorkspaceIds.size)
    await database
      .delete(workspaces)
      .where(inArray(workspaces.id, [...fixtureWorkspaceIds]));
  if (fixtureUserIds.size)
    await database.delete(users).where(inArray(users.id, [...fixtureUserIds]));
  fixtureWorkspaceIds.clear();
  fixtureUserIds.clear();
}

describeDatabase("channel profiles (postgres)", () => {
  afterAll(async () => {
    if (enabled) await cleanup();
  });

  it(
    "keeps multiple channels in one workspace distinct, with their own project lists",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const main = await createChannelProfile({
        workspaceId: fixture.workspaceId,
        createdByUserId: fixture.userId,
        values: channelValues({ name: "Money Made Clear" }),
      });
      const shorts = await createChannelProfile({
        workspaceId: fixture.workspaceId,
        createdByUserId: fixture.userId,
        values: channelValues({ name: "Money Made Clear Shorts" }),
      });
      expect(main.slug).not.toBe(shorts.slug);

      const mainProject = await createProject(fixture, "Long form one");
      const shortsProject = await createProject(fixture, "Vertical one");
      const legacyProject = await createProject(fixture, "Legacy unassigned");
      await assignProjectChannel({
        workspaceId: fixture.workspaceId,
        projectId: mainProject,
        channelProfileId: main.id,
      });
      await assignProjectChannel({
        workspaceId: fixture.workspaceId,
        projectId: shortsProject,
        channelProfileId: shorts.id,
      });

      const mainProjects = await listProjectsForChannel({
        workspaceId: fixture.workspaceId,
        channelProfileId: main.id,
      });
      const shortsProjects = await listProjectsForChannel({
        workspaceId: fixture.workspaceId,
        channelProfileId: shorts.id,
      });
      const unassigned = await listProjectsForChannel({
        workspaceId: fixture.workspaceId,
        channelProfileId: null,
      });
      expect(mainProjects.map((row) => row.id)).toEqual([mainProject]);
      expect(shortsProjects.map((row) => row.id)).toEqual([shortsProject]);
      expect(unassigned.map((row) => row.id)).toEqual([legacyProject]);
    },
  );

  it(
    "gives two channels with the same display name distinct slugs",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const first = await createChannelProfile({
        workspaceId: fixture.workspaceId,
        createdByUserId: fixture.userId,
        values: channelValues({ name: "Shorts" }),
      });
      const second = await createChannelProfile({
        workspaceId: fixture.workspaceId,
        createdByUserId: fixture.userId,
        values: channelValues({ name: "Shorts" }),
      });
      expect(first.slug).toBe("shorts");
      expect(second.slug).toBe("shorts-2");
    },
  );

  it(
    "survives revoking and reconnecting OAuth without losing identity or history",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const externalAccountId = `yt-${randomUUID()}`;
      const connectionId = await connectAccount(fixture, externalAccountId);
      const profile = await createChannelProfile({
        workspaceId: fixture.workspaceId,
        createdByUserId: fixture.userId,
        values: channelValues({ externalAccountId }),
      });
      const projectId = await createProject(fixture, "Episode one");
      await assignProjectChannel({
        workspaceId: fixture.workspaceId,
        projectId,
        channelProfileId: profile.id,
      });

      const connected = await findChannelProfile({
        workspaceId: fixture.workspaceId,
        channelProfileId: profile.id,
      });
      expect(connected?.connection?.id).toBe(connectionId);
      expect(
        resolveChannelPublishAvailability({
          status: connected?.connection?.status ?? null,
          hasExternalAccount: Boolean(connected?.profile.externalAccountId),
        }),
      ).toBe("ready");

      // Revoke: the grant is gone entirely, as a real disconnect does.
      await getDatabase()
        .delete(platformConnections)
        .where(eq(platformConnections.id, connectionId));

      const revoked = await findChannelProfile({
        workspaceId: fixture.workspaceId,
        channelProfileId: profile.id,
      });
      expect(revoked?.profile.id).toBe(profile.id);
      expect(revoked?.profile.externalAccountId).toBe(externalAccountId);
      expect(revoked?.connection).toBeNull();
      expect(
        resolveChannelPublishAvailability({
          status: revoked?.connection?.status ?? null,
          hasExternalAccount: Boolean(revoked?.profile.externalAccountId),
        }),
      ).toBe("disconnected");
      // The production history is untouched by the revocation.
      const stillAssigned = await listProjectsForChannel({
        workspaceId: fixture.workspaceId,
        channelProfileId: profile.id,
      });
      expect(stillAssigned.map((row) => row.id)).toEqual([projectId]);

      // Reconnect issues a brand new connection row for the same account.
      const reconnectedId = await connectAccount(fixture, externalAccountId);
      expect(reconnectedId).not.toBe(connectionId);
      const reconnected = await findChannelProfile({
        workspaceId: fixture.workspaceId,
        channelProfileId: profile.id,
      });
      expect(reconnected?.connection?.id).toBe(reconnectedId);
      expect(
        resolveChannelPublishAvailability({
          status: reconnected?.connection?.status ?? null,
          hasExternalAccount: true,
        }),
      ).toBe("ready");
    },
  );

  it(
    "refuses to assign a project to another workspace's channel",
    { timeout: 90_000 },
    async () => {
      const own = await createFixture();
      const other = await createFixture();
      const foreignChannel = await createChannelProfile({
        workspaceId: other.workspaceId,
        createdByUserId: other.userId,
        values: channelValues({ name: "Someone else" }),
      });
      const projectId = await createProject(own, "Mine");

      await expect(
        assignProjectChannel({
          workspaceId: own.workspaceId,
          projectId,
          channelProfileId: foreignChannel.id,
        }),
      ).rejects.toBeInstanceOf(ChannelProfileNotFoundError);

      // And the database itself refuses the pairing, not just the command.
      await expect(
        getDatabase()
          .update(projects)
          .set({ channelProfileId: foreignChannel.id })
          .where(eq(projects.id, projectId)),
      ).rejects.toBeTruthy();

      const [row] = await getDatabase()
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));
      expect(row?.channelProfileId).toBeNull();
    },
  );

  it(
    "archives without deleting, and hides archived channels from selection",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const profile = await createChannelProfile({
        workspaceId: fixture.workspaceId,
        createdByUserId: fixture.userId,
        values: channelValues({ name: "Retired brand" }),
      });
      const projectId = await createProject(fixture, "Old episode");
      await assignProjectChannel({
        workspaceId: fixture.workspaceId,
        projectId,
        channelProfileId: profile.id,
      });

      const archived = await archiveChannelProfile({
        workspaceId: fixture.workspaceId,
        channelProfileId: profile.id,
      });
      expect(archived.status).toBe("archived");

      const active = await listChannelProfiles({
        workspaceId: fixture.workspaceId,
      });
      expect(active.map((row) => row.profile.id)).not.toContain(profile.id);
      const all = await listChannelProfiles({
        workspaceId: fixture.workspaceId,
        includeArchived: true,
      });
      expect(all.map((row) => row.profile.id)).toContain(profile.id);

      // Archiving must not touch the project or its assignment.
      const [project] = await getDatabase()
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));
      expect(project?.channelProfileId).toBe(profile.id);

      // Archiving twice is refused rather than silently re-archiving.
      await expect(
        archiveChannelProfile({
          workspaceId: fixture.workspaceId,
          channelProfileId: profile.id,
        }),
      ).rejects.toBeInstanceOf(ChannelProfileNotFoundError);
    },
  );

  it(
    "refuses to read or update a channel through the wrong workspace",
    { timeout: 90_000 },
    async () => {
      const own = await createFixture();
      const other = await createFixture();
      const profile = await createChannelProfile({
        workspaceId: own.workspaceId,
        createdByUserId: own.userId,
        values: channelValues({ name: "Scoped" }),
      });

      expect(
        await findChannelProfile({
          workspaceId: other.workspaceId,
          channelProfileId: profile.id,
        }),
      ).toBeNull();
      await expect(
        updateChannelProfile({
          workspaceId: other.workspaceId,
          channelProfileId: profile.id,
          values: channelValues({ name: "Hijacked" }),
        }),
      ).rejects.toBeInstanceOf(ChannelProfileNotFoundError);
      await expect(
        archiveChannelProfile({
          workspaceId: other.workspaceId,
          channelProfileId: profile.id,
        }),
      ).rejects.toBeInstanceOf(ChannelProfileNotFoundError);
    },
  );

  it(
    "clears an assignment without deleting the project",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const profile = await createChannelProfile({
        workspaceId: fixture.workspaceId,
        createdByUserId: fixture.userId,
        values: channelValues({ name: "Temporary" }),
      });
      const projectId = await createProject(fixture, "Reassignable");
      await assignProjectChannel({
        workspaceId: fixture.workspaceId,
        projectId,
        channelProfileId: profile.id,
      });
      await assignProjectChannel({
        workspaceId: fixture.workspaceId,
        projectId,
        channelProfileId: null,
      });
      const [row] = await getDatabase()
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));
      expect(row?.id).toBe(projectId);
      expect(row?.channelProfileId).toBeNull();
    },
  );
});
