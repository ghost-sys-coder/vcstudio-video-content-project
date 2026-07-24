import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let nextClerkInvitationId = 0;
const revokedClerkInvitationIds: string[] = [];

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({
    invitations: {
      createInvitation: async () => ({
        id: `clerk-invitation-${(nextClerkInvitationId += 1)}`,
      }),
      revokeInvitation: async (invitationId: string) => {
        revokedClerkInvitationIds.push(invitationId);
        return { id: invitationId };
      },
    },
  }),
}));

import {
  acceptWorkspaceInvitation,
  inviteWorkspaceMember,
  removeWorkspaceMember,
  revokeWorkspaceInvitation,
  updateWorkspaceMemberRole,
} from "@/db/commands/manage-workspace-members.command";
import { getDatabase } from "@/db/drizzle";
import {
  users,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import {
  LastWorkspaceOwnerError,
  WorkspaceInvitationEmailMismatchError,
  WorkspaceInvitationNotFoundError,
} from "@/lib/domain/errors";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;

const fixtureUserIds = new Set<string>();
const fixtureWorkspaceIds = new Set<string>();

async function createFixtureWorkspace() {
  const database = getDatabase();
  const ownerId = randomUUID();
  const workspaceId = randomUUID();
  const label = randomUUID();
  fixtureUserIds.add(ownerId);
  fixtureWorkspaceIds.add(workspaceId);

  await database.batch([
    database.insert(users).values({
      id: ownerId,
      clerkUserId: `member-integration-owner-${label}`,
      email: `owner-${label}@integration.invalid`,
      displayName: "Owner Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Members Fixture Workspace",
      slug: `member-integration-${label}`,
      createdByUserId: ownerId,
    }),
    database.insert(workspaceMembers).values({
      workspaceId,
      userId: ownerId,
      role: "owner",
    }),
  ]);

  return { workspaceId, ownerId, label };
}

async function createFixtureUser(label: string) {
  const database = getDatabase();
  const userId = randomUUID();
  fixtureUserIds.add(userId);

  await database.insert(users).values({
    id: userId,
    clerkUserId: `member-integration-user-${label}`,
    email: `user-${label}@integration.invalid`,
    displayName: "Invited Fixture",
  });

  return userId;
}

async function cleanupFixtures() {
  const database = getDatabase();
  const workspaceIds = [...fixtureWorkspaceIds];
  const userIds = [...fixtureUserIds];
  if (workspaceIds.length > 0)
    await database
      .delete(workspaces)
      .where(inArray(workspaces.id, workspaceIds));
  if (userIds.length > 0)
    await database.delete(users).where(inArray(users.id, userIds));
  fixtureWorkspaceIds.clear();
  fixtureUserIds.clear();
}

describeDatabase("manage workspace members (postgres)", () => {
  afterAll(async () => {
    if (enabled) await cleanupFixtures();
  });

  it(
    "invites, accepts, and creates a membership with the invited role",
    { timeout: 60_000 },
    async () => {
      const { workspaceId, ownerId, label } = await createFixtureWorkspace();
      const invitedEmail = `invitee-${label}@integration.invalid`;

      const invitation = await inviteWorkspaceMember({
        workspaceId,
        email: invitedEmail,
        role: "editor",
        invitedByUserId: ownerId,
      });
      expect(invitation.status).toBe("pending");
      expect(invitation.clerkInvitationId).toMatch(/^clerk-invitation-/);

      const invitedUserId = await createFixtureUser(label);
      await getDatabase()
        .update(users)
        .set({ email: invitedEmail })
        .where(eq(users.id, invitedUserId));

      const acceptedWorkspaceId = await acceptWorkspaceInvitation({
        invitationId: invitation.id,
        userId: invitedUserId,
        userEmail: invitedEmail,
      });
      expect(acceptedWorkspaceId).toBe(workspaceId);

      const [membership] = await getDatabase()
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, invitedUserId),
          ),
        );
      expect(membership?.role).toBe("editor");

      const [persistedInvitation] = await getDatabase()
        .select()
        .from(workspaceInvitations)
        .where(eq(workspaceInvitations.id, invitation.id));
      expect(persistedInvitation?.status).toBe("accepted");
      expect(persistedInvitation?.acceptedByUserId).toBe(invitedUserId);
    },
  );

  it(
    "rejects acceptance when the signed-in email doesn't match the invitation",
    { timeout: 60_000 },
    async () => {
      const { workspaceId, ownerId, label } = await createFixtureWorkspace();
      const invitation = await inviteWorkspaceMember({
        workspaceId,
        email: `invitee-${label}@integration.invalid`,
        role: "viewer",
        invitedByUserId: ownerId,
      });
      const otherUserId = await createFixtureUser(`${label}-other`);

      await expect(
        acceptWorkspaceInvitation({
          invitationId: invitation.id,
          userId: otherUserId,
          userEmail: "someone-else@integration.invalid",
        }),
      ).rejects.toThrow(WorkspaceInvitationEmailMismatchError);
    },
  );

  it(
    "revoking an invitation prevents it from later being accepted",
    { timeout: 60_000 },
    async () => {
      const { workspaceId, ownerId, label } = await createFixtureWorkspace();
      const invitedEmail = `invitee-${label}@integration.invalid`;
      const invitation = await inviteWorkspaceMember({
        workspaceId,
        email: invitedEmail,
        role: "editor",
        invitedByUserId: ownerId,
      });

      await revokeWorkspaceInvitation({
        workspaceId,
        invitationId: invitation.id,
        actorUserId: ownerId,
      });
      expect(revokedClerkInvitationIds).toContain(invitation.clerkInvitationId);

      const invitedUserId = await createFixtureUser(`${label}-revoked`);
      await getDatabase()
        .update(users)
        .set({ email: invitedEmail })
        .where(eq(users.id, invitedUserId));

      await expect(
        acceptWorkspaceInvitation({
          invitationId: invitation.id,
          userId: invitedUserId,
          userEmail: invitedEmail,
        }),
      ).rejects.toThrow(WorkspaceInvitationNotFoundError);
    },
  );

  it(
    "re-inviting the same pending email refreshes rather than duplicates",
    { timeout: 60_000 },
    async () => {
      const { workspaceId, ownerId, label } = await createFixtureWorkspace();
      const invitedEmail = `invitee-${label}@integration.invalid`;

      const first = await inviteWorkspaceMember({
        workspaceId,
        email: invitedEmail,
        role: "viewer",
        invitedByUserId: ownerId,
      });
      const second = await inviteWorkspaceMember({
        workspaceId,
        email: invitedEmail,
        role: "editor",
        invitedByUserId: ownerId,
      });
      expect(second.id).not.toBe(first.id);

      const pending = await getDatabase()
        .select()
        .from(workspaceInvitations)
        .where(
          and(
            eq(workspaceInvitations.workspaceId, workspaceId),
            eq(workspaceInvitations.email, invitedEmail),
            eq(workspaceInvitations.status, "pending"),
          ),
        );
      expect(pending).toHaveLength(1);
      expect(pending[0]?.role).toBe("editor");
    },
  );

  it(
    "blocks demoting or removing the sole remaining owner",
    { timeout: 60_000 },
    async () => {
      const { workspaceId, ownerId } = await createFixtureWorkspace();
      const [ownerMembership] = await getDatabase()
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, ownerId),
          ),
        );
      if (!ownerMembership)
        throw new Error("Fixture owner membership missing.");

      await expect(
        updateWorkspaceMemberRole({
          workspaceId,
          membershipId: ownerMembership.id,
          role: "editor",
          actorUserId: ownerId,
        }),
      ).rejects.toThrow(LastWorkspaceOwnerError);

      await expect(
        removeWorkspaceMember({
          workspaceId,
          membershipId: ownerMembership.id,
          actorUserId: ownerId,
        }),
      ).rejects.toThrow(LastWorkspaceOwnerError);
    },
  );

  it(
    "allows demoting an owner once a second owner exists",
    { timeout: 60_000 },
    async () => {
      const { workspaceId, ownerId, label } = await createFixtureWorkspace();
      const secondOwnerId = await createFixtureUser(`${label}-second-owner`);
      await getDatabase().insert(workspaceMembers).values({
        workspaceId,
        userId: secondOwnerId,
        role: "owner",
      });

      const [ownerMembership] = await getDatabase()
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, workspaceId),
            eq(workspaceMembers.userId, ownerId),
          ),
        );
      if (!ownerMembership)
        throw new Error("Fixture owner membership missing.");

      await updateWorkspaceMemberRole({
        workspaceId,
        membershipId: ownerMembership.id,
        role: "editor",
        actorUserId: secondOwnerId,
      });

      const [updated] = await getDatabase()
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.id, ownerMembership.id));
      expect(updated?.role).toBe("editor");
    },
  );
});
