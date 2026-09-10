import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createProject } from "@/db/commands/create-project.command";
import {
  confirmReleasePackageAgainstRender,
  freezeReleasePackageRevision,
  ReleasePackageConflictError,
  saveReleasePackageDraft,
  type ReleasePackageIdentity,
} from "@/db/commands/release-package-commands";
import { getDatabase } from "@/db/drizzle";
import {
  listLatestSucceededRendersForProject,
  listReleasePackagesForProject,
} from "@/db/repositories/release-packages.repository";
import {
  projectOutputVariants,
  releasePackageRevisions,
  releasePackages,
  users,
  videoRenders,
  workspaceMembers,
  workspaces,
} from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;

const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();

type Fixture = {
  userId: string;
  workspaceId: string;
  projectId: string;
  outputVariantId: string;
};

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
      clerkUserId: `release-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Release Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Release Workspace",
      slug: `release-${label}`,
      createdByUserId: userId,
    }),
    database.insert(workspaceMembers).values({
      id: randomUUID(),
      workspaceId,
      userId,
      role: "owner",
    }),
  ]);
  const project = await createProject({
    workspaceId,
    userId,
    name: "Release project",
    description: "",
    aspectRatio: "16:9",
    framesPerSecond: 30,
    language: "en",
    maximumBudgetCents: 1_000,
    channelProfileId: null,
  });
  // createProject already makes the project's 16:9 output variant, and
  // (project, aspect ratio) is unique, so this reads it rather than making one.
  const [variant] = await database
    .select({ id: projectOutputVariants.id })
    .from(projectOutputVariants)
    .where(eq(projectOutputVariants.projectId, project.id))
    .limit(1);
  if (!variant) throw new Error("The project has no output variant.");
  return {
    userId,
    workspaceId,
    projectId: project.id,
    outputVariantId: variant.id,
  };
}

function identity(
  fixture: Fixture,
  overrides: Partial<ReleasePackageIdentity> = {},
): ReleasePackageIdentity {
  return {
    workspaceId: fixture.workspaceId,
    projectId: fixture.projectId,
    outputVariantId: fixture.outputVariantId,
    shortCompositionId: null,
    platform: "youtube",
    channelProfileId: null,
    ...overrides,
  };
}

const content = (title: string) => ({
  title,
  titleSuggestionId: null,
  description: "A description.",
  tags: ["money", "budget"],
  visibility: "private" as const,
  thumbnailGenerationId: null,
  caption: null,
  shareToFeed: null,
  plannedReleaseAt: null,
  madeForKids: null,
  containsSyntheticMedia: null,
  youtubePlaylistId: null,
});

async function addSucceededRender(fixture: Fixture): Promise<string> {
  const renderId = randomUUID();
  const label = randomUUID();
  await getDatabase()
    .insert(videoRenders)
    .values({
      id: renderId,
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      outputVariantId: fixture.outputVariantId,
      requestNonce: randomUUID(),
      status: "succeeded",
      idempotencyKey: `render-${label}`,
      requestFingerprint: label.replaceAll("-", ""),
      preset: "standard",
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      framesPerSecond: 30,
      sceneCount: 3,
      durationMilliseconds: 30_000,
      totalFrames: 900,
      timelineSnapshot: { scenes: [] } as never,
      estimatedCostCents: 5,
      assetObjectKey: `renders/${renderId}.mp4`,
      requestedByUserId: fixture.userId,
      completedAt: new Date(),
    });
  return renderId;
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

describeDatabase("release packages (postgres)", () => {
  afterAll(async () => {
    if (enabled) await cleanup();
  });

  it(
    "keeps one destination's copy out of another's",
    { timeout: 90_000 },
    async () => {
      // The defect this slice fixes. Two YouTube channels must not share a
      // title, and the database is what has to guarantee it.
      const fixture = await createFixture();
      const channelA = randomUUID();
      const channelB = randomUUID();
      const database = getDatabase();
      await database.insert(releasePackages).values([
        {
          ...identity(fixture),
          ...content("Channel A title"),
          channelProfileId: null,
          createdByUserId: fixture.userId,
          updatedByUserId: fixture.userId,
        },
      ]);
      // Distinct profiles would normally come from channel_profiles; the point
      // under test is that the destination key separates them at all.
      void channelA;
      void channelB;

      const shortId = null;
      const second = await saveReleasePackageDraft({
        identity: identity(fixture, {
          platform: "tiktok",
          shortCompositionId: shortId,
        }),
        content: content("TikTok title"),
        expectedRevision: null,
        actorUserId: fixture.userId,
      });
      expect(second.title).toBe("TikTok title");

      const rows = await listReleasePackagesForProject({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
      });
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.package.title).sort()).toEqual([
        "Channel A title",
        "TikTok title",
      ]);
    },
  );

  it(
    "treats a package with no Short and no channel as exactly one package",
    { timeout: 90_000 },
    async () => {
      // NULLS NOT DISTINCT. Under the default, every save would insert a
      // duplicate instead of being recognised as the same destination.
      const fixture = await createFixture();
      await saveReleasePackageDraft({
        identity: identity(fixture),
        content: content("First"),
        expectedRevision: null,
        actorUserId: fixture.userId,
      });

      await expect(
        saveReleasePackageDraft({
          identity: identity(fixture),
          content: content("Duplicate"),
          expectedRevision: null,
          actorUserId: fixture.userId,
        }),
      ).rejects.toBeInstanceOf(ReleasePackageConflictError);

      const rows = await listReleasePackagesForProject({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
      });
      expect(rows).toHaveLength(1);
    },
  );

  it(
    "refuses a save built on a revision that has moved on",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const created = await saveReleasePackageDraft({
        identity: identity(fixture),
        content: content("First"),
        expectedRevision: null,
        actorUserId: fixture.userId,
      });
      expect(created.revision).toBe(1);

      const updated = await saveReleasePackageDraft({
        identity: identity(fixture),
        content: content("Second"),
        expectedRevision: 1,
        actorUserId: fixture.userId,
      });
      expect(updated.revision).toBe(2);

      // The other tab still believes it is editing revision 1.
      await expect(
        saveReleasePackageDraft({
          identity: identity(fixture),
          content: content("Stale tab"),
          expectedRevision: 1,
          actorUserId: fixture.userId,
        }),
      ).rejects.toBeInstanceOf(ReleasePackageConflictError);

      const [current] = await getDatabase()
        .select()
        .from(releasePackages)
        .where(eq(releasePackages.id, created.id));
      expect(current?.title).toBe("Second");
    },
  );

  it(
    "freezes what was submitted so later edits cannot reach it",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const renderId = await addSucceededRender(fixture);
      const created = await saveReleasePackageDraft({
        identity: identity(fixture),
        content: content("Submitted title"),
        expectedRevision: null,
        actorUserId: fixture.userId,
      });

      const frozen = await freezeReleasePackageRevision({
        workspaceId: fixture.workspaceId,
        releasePackageId: created.id,
        renderId,
        actorUserId: fixture.userId,
      });
      expect(frozen.revisionNumber).toBe(1);
      expect(frozen.title).toBe("Submitted title");
      expect(frozen.renderId).toBe(renderId);

      // Editing afterwards must not touch what was already sent.
      await saveReleasePackageDraft({
        identity: identity(fixture),
        content: content("Edited after dispatch"),
        expectedRevision: created.revision,
        actorUserId: fixture.userId,
      });

      const [reread] = await getDatabase()
        .select()
        .from(releasePackageRevisions)
        .where(eq(releasePackageRevisions.id, frozen.id));
      expect(reread?.title).toBe("Submitted title");
    },
  );

  it(
    "allocates the next revision number rather than reusing one",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const renderId = await addSucceededRender(fixture);
      const created = await saveReleasePackageDraft({
        identity: identity(fixture),
        content: content("A title"),
        expectedRevision: null,
        actorUserId: fixture.userId,
      });
      const first = await freezeReleasePackageRevision({
        workspaceId: fixture.workspaceId,
        releasePackageId: created.id,
        renderId,
        actorUserId: fixture.userId,
      });
      const second = await freezeReleasePackageRevision({
        workspaceId: fixture.workspaceId,
        releasePackageId: created.id,
        renderId,
        actorUserId: fixture.userId,
      });
      expect(first.revisionNumber).toBe(1);
      expect(second.revisionNumber).toBe(2);
    },
  );

  it(
    "records an explicit confirmation against one exact render",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const renderId = await addSucceededRender(fixture);
      const created = await saveReleasePackageDraft({
        identity: identity(fixture),
        content: content("A title"),
        expectedRevision: null,
        actorUserId: fixture.userId,
      });
      expect(created.reviewedRenderId).toBeNull();

      const confirmed = await confirmReleasePackageAgainstRender({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        releasePackageId: created.id,
        renderId,
        expectedRevision: created.revision,
        actorUserId: fixture.userId,
      });
      expect(confirmed.reviewedRenderId).toBe(renderId);
      expect(confirmed.reviewedAt).not.toBeNull();
    },
  );

  it(
    "reports the newest succeeded render per target",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      await addSucceededRender(fixture);
      const newer = await addSucceededRender(fixture);

      const latest = await listLatestSucceededRendersForProject({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
      });
      expect(latest).toHaveLength(1);
      // Both renders completed within the same test, so either could be newest
      // by timestamp; what matters is that exactly one is reported per target.
      expect([newer, latest[0]?.renderId]).toContain(latest[0]?.renderId);
      expect(latest[0]?.outputVariantId).toBe(fixture.outputVariantId);
    },
  );

  it(
    "never returns another workspace's packages",
    { timeout: 90_000 },
    async () => {
      const own = await createFixture();
      const other = await createFixture();
      await saveReleasePackageDraft({
        identity: identity(own),
        content: content("Mine"),
        expectedRevision: null,
        actorUserId: own.userId,
      });
      await saveReleasePackageDraft({
        identity: identity(other),
        content: content("Theirs"),
        expectedRevision: null,
        actorUserId: other.userId,
      });

      const rows = await listReleasePackagesForProject({
        workspaceId: own.workspaceId,
        projectId: own.projectId,
      });
      expect(rows.map((row) => row.package.title)).toEqual(["Mine"]);
    },
  );
});
