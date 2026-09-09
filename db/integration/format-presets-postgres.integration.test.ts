import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { config as loadEnvironment } from "dotenv";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  archiveFormatPreset,
  createFormatPreset,
  FormatPresetNotFoundError,
  publishFormatPresetVersion,
} from "@/db/commands/format-preset-commands";
import { createProject } from "@/db/commands/create-project.command";
import {
  findCurrentFormatPresetVersion,
  findFormatPresetVersion,
  listFormatPresets,
  listProjectsFromIdea,
} from "@/db/repositories/format-presets.repository";
import { getDatabase } from "@/db/drizzle";
import {
  contentIdeas,
  formatPresetVersions,
  projects,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { resolveFormatInheritance } from "@/lib/formats/format-inheritance";
import type { FormatPresetVersionInput } from "@/lib/schemas/format-preset";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;

const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();

type Fixture = { userId: string; workspaceId: string };

function values(
  overrides: Partial<FormatPresetVersionInput> = {},
): FormatPresetVersionInput {
  return {
    audienceDescription: "Beginner investors",
    editorialStructure: "Hook, three segments, recap",
    targetDurationSeconds: 600,
    aspectRatio: "16:9",
    framesPerSecond: 30,
    voicePresetId: null,
    stylePresetId: null,
    captionsEnabled: true,
    defaultMaximumBudgetCents: 5000,
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
      clerkUserId: `format-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Format Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Format Workspace",
      slug: `format-${label}`,
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

describeDatabase("format presets (postgres)", () => {
  afterAll(async () => {
    if (enabled) await cleanup();
  });

  it(
    "editing a format never changes a project already in production",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const preset = await createFormatPreset({
        workspaceId: fixture.workspaceId,
        createdByUserId: fixture.userId,
        name: "Weekly long form",
        channelProfileId: null,
        values: values({ defaultMaximumBudgetCents: 5000 }),
      });

      const inProgress = await createProject({
        workspaceId: fixture.workspaceId,
        userId: fixture.userId,
        name: "Episode one",
        description: "",
        aspectRatio: "16:9",
        framesPerSecond: 30,
        language: "en",
        maximumBudgetCents: 5000,
        formatPresetVersionId: preset.versionId,
      });

      // The creator edits the format after production has started.
      const second = await publishFormatPresetVersion({
        workspaceId: fixture.workspaceId,
        formatPresetId: preset.presetId,
        createdByUserId: fixture.userId,
        values: values({
          defaultMaximumBudgetCents: 9000,
          targetDurationSeconds: 1200,
        }),
      });
      expect(second.versionNumber).toBe(2);

      // The in-progress project still points at version 1, unchanged.
      const [stored] = await getDatabase()
        .select()
        .from(projects)
        .where(eq(projects.id, inProgress.id));
      expect(stored?.formatPresetVersionId).toBe(preset.versionId);

      const snapshot = await findFormatPresetVersion({
        workspaceId: fixture.workspaceId,
        formatPresetVersionId: preset.versionId,
      });
      expect(snapshot?.versionNumber).toBe(1);
      expect(snapshot?.defaultMaximumBudgetCents).toBe(5000);
      expect(snapshot?.targetDurationSeconds).toBe(600);

      // A new project started now inherits version 2 instead.
      const current = await findCurrentFormatPresetVersion({
        workspaceId: fixture.workspaceId,
        formatPresetId: preset.presetId,
      });
      expect(current?.id).toBe(second.id);
      expect(current?.defaultMaximumBudgetCents).toBe(9000);
    },
  );

  it(
    "reports which inherited values a creator overrode",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const preset = await createFormatPreset({
        workspaceId: fixture.workspaceId,
        createdByUserId: fixture.userId,
        name: "Shorts format",
        channelProfileId: null,
        values: values({ aspectRatio: "9:16", defaultMaximumBudgetCents: 200 }),
      });
      const version = await findFormatPresetVersion({
        workspaceId: fixture.workspaceId,
        formatPresetVersionId: preset.versionId,
      });
      expect(version).not.toBeNull();
      if (!version) return;

      const rows = resolveFormatInheritance({
        preset: {
          aspectRatio: version.aspectRatio,
          framesPerSecond: version.framesPerSecond,
          targetDurationSeconds: version.targetDurationSeconds,
          maximumBudgetCents: version.defaultMaximumBudgetCents,
          captionsEnabled: version.captionsEnabled,
          voicePresetId: version.voicePresetId,
          stylePresetId: version.stylePresetId,
        },
        effective: {
          aspectRatio: version.aspectRatio,
          framesPerSecond: version.framesPerSecond,
          targetDurationSeconds: version.targetDurationSeconds,
          // The creator raised the budget for this one video.
          maximumBudgetCents: 500,
          captionsEnabled: version.captionsEnabled,
          voicePresetId: version.voicePresetId,
          stylePresetId: version.stylePresetId,
        },
      });
      const budget = rows.find((row) => row.field === "maximumBudgetCents");
      expect(budget?.origin).toBe("overridden");
      expect(budget?.presetValue).toBe("200");
      expect(budget?.effectiveValue).toBe("500");
      expect(
        rows.filter((row) => row.field !== "maximumBudgetCents"),
      ).toSatisfy((other: typeof rows) =>
        other.every((row) => row.origin !== "overridden"),
      );
    },
  );

  it(
    "keeps repeat use of one saved idea visible as history",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const ideaId = randomUUID();
      await getDatabase().insert(contentIdeas).values({
        id: ideaId,
        workspaceId: fixture.workspaceId,
        niche: "personal finance",
        topic: "Index funds",
        createdByUserId: fixture.userId,
      });

      const first = await createProject({
        workspaceId: fixture.workspaceId,
        userId: fixture.userId,
        name: "Index funds part one",
        description: "",
        aspectRatio: "16:9",
        framesPerSecond: 30,
        language: "en",
        maximumBudgetCents: 1000,
        sourceContentIdeaId: ideaId,
      });
      // A deliberate follow-up from the same idea must be allowed.
      const second = await createProject({
        workspaceId: fixture.workspaceId,
        userId: fixture.userId,
        name: "Index funds part two",
        description: "",
        aspectRatio: "16:9",
        framesPerSecond: 30,
        language: "en",
        maximumBudgetCents: 1000,
        sourceContentIdeaId: ideaId,
      });

      const uses = await listProjectsFromIdea({
        workspaceId: fixture.workspaceId,
        contentIdeaId: ideaId,
      });
      expect(uses).toHaveLength(2);
      expect(uses.map((row) => row.id).sort()).toEqual(
        [first.id, second.id].sort(),
      );
    },
  );

  it(
    "supports blank projects with no format and no idea",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const project = await createProject({
        workspaceId: fixture.workspaceId,
        userId: fixture.userId,
        name: "Blank",
        description: "",
        aspectRatio: "16:9",
        framesPerSecond: 30,
        language: "en",
        maximumBudgetCents: 1000,
      });
      const [stored] = await getDatabase()
        .select()
        .from(projects)
        .where(eq(projects.id, project.id));
      expect(stored?.formatPresetVersionId).toBeNull();
      expect(stored?.sourceContentIdeaId).toBeNull();
    },
  );

  it(
    "refuses to publish a version through the wrong workspace",
    { timeout: 90_000 },
    async () => {
      const own = await createFixture();
      const other = await createFixture();
      const preset = await createFormatPreset({
        workspaceId: own.workspaceId,
        createdByUserId: own.userId,
        name: "Scoped format",
        channelProfileId: null,
        values: values(),
      });
      await expect(
        publishFormatPresetVersion({
          workspaceId: other.workspaceId,
          formatPresetId: preset.presetId,
          createdByUserId: other.userId,
          values: values(),
        }),
      ).rejects.toBeInstanceOf(FormatPresetNotFoundError);
      await expect(
        archiveFormatPreset({
          workspaceId: other.workspaceId,
          formatPresetId: preset.presetId,
        }),
      ).rejects.toBeInstanceOf(FormatPresetNotFoundError);
      expect(
        await listFormatPresets({ workspaceId: other.workspaceId }),
      ).toHaveLength(0);
    },
  );

  it(
    "archives a format while keeping its versions readable by existing projects",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const preset = await createFormatPreset({
        workspaceId: fixture.workspaceId,
        createdByUserId: fixture.userId,
        name: "Retired format",
        channelProfileId: null,
        values: values(),
      });
      await createProject({
        workspaceId: fixture.workspaceId,
        userId: fixture.userId,
        name: "Made with the retired format",
        description: "",
        aspectRatio: "16:9",
        framesPerSecond: 30,
        language: "en",
        maximumBudgetCents: 1000,
        formatPresetVersionId: preset.versionId,
      });

      await archiveFormatPreset({
        workspaceId: fixture.workspaceId,
        formatPresetId: preset.presetId,
      });
      expect(
        await listFormatPresets({ workspaceId: fixture.workspaceId }),
      ).toHaveLength(0);
      expect(
        await findFormatPresetVersion({
          workspaceId: fixture.workspaceId,
          formatPresetVersionId: preset.versionId,
        }),
      ).not.toBeNull();
    },
  );

  it(
    "refuses to delete a format version a project still cites",
    { timeout: 90_000 },
    async () => {
      const fixture = await createFixture();
      const preset = await createFormatPreset({
        workspaceId: fixture.workspaceId,
        createdByUserId: fixture.userId,
        name: "Cited format",
        channelProfileId: null,
        values: values(),
      });
      await createProject({
        workspaceId: fixture.workspaceId,
        userId: fixture.userId,
        name: "Citing project",
        description: "",
        aspectRatio: "16:9",
        framesPerSecond: 30,
        language: "en",
        maximumBudgetCents: 1000,
        formatPresetVersionId: preset.versionId,
      });
      // The version is immutable history; the database must protect it.
      await expect(
        getDatabase()
          .delete(formatPresetVersions)
          .where(eq(formatPresetVersions.id, preset.versionId)),
      ).rejects.toBeTruthy();
    },
  );
});
