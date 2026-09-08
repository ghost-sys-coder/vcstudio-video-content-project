import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { updateScene, approveScene } from "@/db/commands/scene-commands";
import { listCurrentScenes } from "@/db/repositories/scenes.repository";
import {
  listApprovedSceneImageAssets,
  listApprovedSceneAudioAssets,
  getProjectSubtitleSettings,
} from "@/db/repositories/subtitle.repository";
import { listReusedImages } from "@/db/repositories/scene-revision-media.repository";
import { DEFAULT_CAPTION_STYLE } from "@/lib/subtitles/caption-style";
import { config as loadEnvironment } from "dotenv";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));

import {
  approveSceneImageGeneration,
  rejectSceneImageGeneration,
  saveUploadedSceneImage,
} from "@/db/commands/scene-image-commands";
import {
  approveSceneAudioGeneration,
  rejectSceneAudioGeneration,
  saveRecordedSceneAudio,
} from "@/db/commands/scene-audio-commands";
import { findSceneImageGeneration } from "@/db/repositories/scene-images.repository";
import { findSceneAudioGeneration } from "@/db/repositories/scene-audio.repository";
import { getDatabase } from "@/db/drizzle";
import {
  projects,
  projectScriptVersions,
  sceneAnalysisRuns,
  scenes,
  sceneVersions,
  users,
  workspaceMembers,
  workspaces,
  sceneAudioGenerations,
  projectSubtitleSettings,
  projectOutputVariants,
  sceneVariantFramings,
} from "@/db/schema";

const enabled = process.env.RUN_DATABASE_INTEGRATION_TESTS === "true";
if (enabled) loadEnvironment({ path: ".env", quiet: true });
const describeDatabase = enabled ? describe.sequential : describe.skip;

type Fixture = {
  userId: string;
  workspaceId: string;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
};

const fixtureWorkspaceIds = new Set<string>();
const fixtureUserIds = new Set<string>();

async function createFixture(): Promise<Fixture> {
  const database = getDatabase();
  const userId = randomUUID();
  const workspaceId = randomUUID();
  const projectId = randomUUID();
  const scriptVersionId = randomUUID();
  const analysisRunId = randomUUID();
  const sceneId = randomUUID();
  const sceneVersionId = randomUUID();
  const label = randomUUID();
  const now = new Date();
  fixtureUserIds.add(userId);
  fixtureWorkspaceIds.add(workspaceId);

  await database.batch([
    database.insert(users).values({
      id: userId,
      clerkUserId: `media-upload-integration-${label}`,
      email: `${label}@integration.invalid`,
      displayName: "Media Upload Fixture",
    }),
    database.insert(workspaces).values({
      id: workspaceId,
      name: "Media Upload Workspace",
      slug: `media-upload-integration-${label}`,
      createdByUserId: userId,
    }),
    database.insert(workspaceMembers).values({
      id: randomUUID(),
      workspaceId,
      userId,
      role: "owner",
    }),
    database.insert(projects).values({
      id: projectId,
      workspaceId,
      name: "Media Upload Project",
      status: "planning",
      aspectRatio: "16:9",
      width: 1920,
      height: 1080,
      framesPerSecond: 30,
      language: "en",
      maximumBudgetCents: 1_000,
      createdByUserId: userId,
    }),
    database.insert(projectScriptVersions).values({
      id: scriptVersionId,
      workspaceId,
      projectId,
      versionNumber: 1,
      content: "An isolated integration-test narration.",
      characterCount: 39,
      estimatedNarrationDurationSeconds: 5,
      createdByUserId: userId,
      status: "approved",
      approvedByUserId: userId,
      approvedAt: now,
    }),
    database.insert(sceneAnalysisRuns).values({
      id: analysisRunId,
      workspaceId,
      projectId,
      scriptVersionId,
      requestedByUserId: userId,
      idempotencyKey: `media-upload-analysis-${label}`,
      requestFingerprint: label.replaceAll("-", ""),
      model: "integration-test-model",
      promptVersion: "integration-v1",
      finalPrompt: "Integration fixture analysis prompt.",
      status: "completed",
      progressPercent: 100,
      estimatedCostCents: 1,
      actualCostCents: 1,
      attemptCount: 1,
      startedAt: now,
      completedAt: now,
    }),
    database.insert(scenes).values({
      id: sceneId,
      workspaceId,
      projectId,
      scriptVersionId,
      analysisRunId,
      sceneNumber: 1,
      status: "approved",
      currentVersion: 1,
    }),
    database.insert(sceneVersions).values({
      id: sceneVersionId,
      workspaceId,
      projectId,
      sceneId,
      versionNumber: 1,
      narrationText: "An isolated integration-test narration.",
      visualDescription: "A clean editorial illustration.",
      locationDescription: "A neutral studio.",
      actionDescription: "A presenter explains one concept.",
      cameraShot: "medium",
      cameraAngle: "eye-level",
      cameraMotion: "static",
      emotionalTone: "confident",
      characterNames: [],
      propNames: [],
      continuityNotes: "Maintain the same composition.",
      estimatedDurationMilliseconds: 5_000,
      startTimeMilliseconds: 0,
      endTimeMilliseconds: 5_000,
      createdByUserId: userId,
    }),
  ]);

  return { userId, workspaceId, projectId, sceneId, sceneVersionId };
}

async function cleanup(): Promise<void> {
  const database = getDatabase();
  if (fixtureWorkspaceIds.size > 0)
    await database
      .delete(workspaces)
      .where(inArray(workspaces.id, [...fixtureWorkspaceIds]));
  if (fixtureUserIds.size > 0)
    await database.delete(users).where(inArray(users.id, [...fixtureUserIds]));
  fixtureWorkspaceIds.clear();
  fixtureUserIds.clear();
}

describeDatabase("scene media upload invariants", () => {
  beforeAll(() => {
    if (process.env.NODE_ENV === "production")
      throw new Error("Integration tests must not run against production.");
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL is required for integration tests.");
  });
  afterEach(cleanup);
  afterAll(cleanup);

  it.each(["narration", "visual", "duration", "both"] as const)(
    "reuses only compatible approved media after a %s revision",
    async (change) => {
      const fixture = await createFixture();
      const scope = {
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
      };
      const [original] = await listCurrentScenes(scope);
      if (!original) throw new Error("Missing fixture scene");
      const image = await saveUploadedSceneImage({
        ...fixture,
        generationId: randomUUID(),
        size: "1536x1024",
        objectKey: `integration/${randomUUID()}.png`,
        contentType: "image/png",
        sizeBytes: 2048,
        width: 1536,
        height: 1024,
        etag: "fixture",
        requestedByUserId: fixture.userId,
      });
      await approveSceneImageGeneration({
        ...scope,
        generationId: image.id,
        userId: fixture.userId,
      });
      const audio = await saveRecordedSceneAudio({
        ...fixture,
        generationId: randomUUID(),
        objectKey: `integration/${randomUUID()}.webm`,
        contentType: "audio/webm",
        sizeBytes: 4096,
        etag: "fixture",
        durationMilliseconds: 5000,
        narrationText: original.version.narrationText,
        requestedByUserId: fixture.userId,
      });
      await getDatabase()
        .update(sceneAudioGenerations)
        .set({ inspectionStatus: "succeeded" })
        .where(
          and(
            eq(sceneAudioGenerations.workspaceId, scope.workspaceId),
            eq(sceneAudioGenerations.id, audio.id),
          ),
        );
      await approveSceneAudioGeneration({
        ...scope,
        generationId: audio.id,
        userId: fixture.userId,
      });
      await getDatabase()
        .insert(projectSubtitleSettings)
        .values({
          ...scope,
          captionStyle: DEFAULT_CAPTION_STYLE,
          segmentTextOverrides: {
            [`${original.version.id}:0`]: "Edited caption",
          },
          updatedByUserId: fixture.userId,
        });
      const beforeImage = await findSceneImageGeneration({
        ...scope,
        generationId: image.id,
      });
      const variantId = randomUUID();
      await getDatabase()
        .insert(projectOutputVariants)
        .values({
          ...scope,
          id: variantId,
          name: "Vertical fixture",
          aspectRatio: "9:16",
          width: 1080,
          height: 1920,
          createdByUserId: fixture.userId,
        });
      await getDatabase()
        .insert(sceneVariantFramings)
        .values({
          ...scope,
          outputVariantId: variantId,
          sceneId: original.scene.id,
          sceneVersionId: original.version.id,
          sourceImageGenerationId: image.id,
          focalPointXBps: 6500,
          scaleBps: 12000,
          updatedByUserId: fixture.userId,
        });
      const beforeAudio = await findSceneAudioGeneration({
        ...scope,
        generationId: audio.id,
      });
      const input = {
        ...original.version,
        ...scope,
        userId: fixture.userId,
        sceneId: original.scene.id,
        expectedVersion: 1,
        narrationText:
          change === "narration" || change === "both"
            ? "Changed narration."
            : original.version.narrationText,
        visualDescription:
          change === "visual" || change === "both"
            ? "A new composition."
            : original.version.visualDescription,
        estimatedDurationMilliseconds: change === "duration" ? 6000 : 5000,
      };
      await updateScene(input);
      const [current] = await listCurrentScenes(scope);
      if (!current) throw new Error("Missing revision");
      if (change === "duration") {
        await expect(
          rejectSceneImageGeneration({
            ...scope,
            generationId: image.id,
            userId: fixture.userId,
          }),
        ).rejects.toThrow("MEDIA_REVIEW_REQUIRES_CURRENT_SCENE_VERSION");
        await expect(
          rejectSceneAudioGeneration({
            ...scope,
            generationId: audio.id,
            userId: fixture.userId,
          }),
        ).rejects.toThrow("MEDIA_REVIEW_REQUIRES_CURRENT_SCENE_VERSION");
      }
      const readScope = { ...scope, sceneVersionIds: [current.version.id] };
      const framings = await getDatabase()
        .select()
        .from(sceneVariantFramings)
        .where(
          and(
            eq(sceneVariantFramings.workspaceId, scope.workspaceId),
            eq(sceneVariantFramings.sceneVersionId, current.version.id),
          ),
        );
      expect(framings.length).toBe(
        change === "narration" || change === "duration" ? 1 : 0,
      );
      if (framings[0])
        expect(framings[0]).toMatchObject({
          sourceImageGenerationId: image.id,
          focalPointXBps: 6500,
          scaleBps: 12000,
        });
      const images = await listApprovedSceneImageAssets({
        ...readScope,
        size: "1536x1024",
      });
      const audios = await listApprovedSceneAudioAssets(readScope);
      expect(images.map((row) => row.generationId)).toEqual(
        change === "narration" || change === "duration" ? [image.id] : [],
      );
      expect(audios.map((row) => row.generationId)).toEqual(
        change === "visual" || change === "duration" ? [audio.id] : [],
      );
      const captions = await getProjectSubtitleSettings(scope);
      expect(captions?.segmentTextOverrides[`${current.version.id}:0`]).toBe(
        change === "visual" || change === "duration"
          ? "Edited caption"
          : undefined,
      );
      expect(
        await findSceneImageGeneration({ ...scope, generationId: image.id }),
      ).toEqual(beforeImage);
      expect(
        await findSceneAudioGeneration({ ...scope, generationId: audio.id }),
      ).toEqual(beforeAudio);
      expect(
        await listReusedImages({ ...readScope, workspaceId: randomUUID() }),
      ).toEqual([]);
      // A duration-only revision carries explicit bindings forward again.
      await updateScene({
        ...input,
        expectedVersion: 2,
        estimatedDurationMilliseconds: 7000,
      });
      const [next] = await listCurrentScenes(scope);
      if (!next) throw new Error("Missing second revision");
      expect(
        (
          await listApprovedSceneImageAssets({
            ...scope,
            sceneVersionIds: [next.version.id],
            size: "1536x1024",
          })
        ).map((row) => row.generationId),
      ).toEqual(images.map((row) => row.generationId));
      expect(
        (
          await listApprovedSceneAudioAssets({
            ...scope,
            sceneVersionIds: [next.version.id],
          })
        ).map((row) => row.generationId),
      ).toEqual(audios.map((row) => row.generationId));
      await approveScene({
        ...scope,
        sceneId: next.scene.id,
        expectedVersion: 3,
      });
      const replacement = await saveUploadedSceneImage({
        ...fixture,
        sceneVersionId: next.version.id,
        generationId: randomUUID(),
        size: "1536x1024",
        objectKey: `integration/${randomUUID()}.png`,
        contentType: "image/png",
        sizeBytes: 2048,
        width: 1536,
        height: 1024,
        etag: "replacement",
        requestedByUserId: fixture.userId,
      });
      await approveSceneImageGeneration({
        ...scope,
        generationId: replacement.id,
        userId: fixture.userId,
      });
      expect(
        (
          await listApprovedSceneImageAssets({
            ...scope,
            sceneVersionIds: [next.version.id],
            size: "1536x1024",
          })
        ).map((row) => row.generationId),
      ).toEqual([replacement.id]);
    },
    60_000,
  );

  it("saves an uploaded scene image with nulled AI-only fields and no reservation", async () => {
    const fixture = await createFixture();
    const generationId = randomUUID();
    const created = await saveUploadedSceneImage({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      sceneId: fixture.sceneId,
      sceneVersionId: fixture.sceneVersionId,
      generationId,
      size: "1536x1024",
      objectKey: `integration/${generationId}.png`,
      contentType: "image/png",
      sizeBytes: 2048,
      width: 1536,
      height: 1024,
      etag: "etag-integration",
      requestedByUserId: fixture.userId,
    });
    expect(created.id).toBe(generationId);
    expect(created.source).toBe("user_uploaded");
    expect(created.status).toBe("succeeded");
    expect(created.reviewStatus).toBe("pending");
    expect(created.estimatedCostCents).toBe(0);
    expect(created.model).toBeNull();
    expect(created.stylePresetVersionId).toBeNull();
    expect(created.idempotencyKey).toBeNull();

    // Approvable through the existing (unchanged) approval path.
    const approved = await approveSceneImageGeneration({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      generationId,
      userId: fixture.userId,
    });
    expect(approved.reviewStatus).toBe("approved");
  }, 30_000);

  it("increments generationVersion alongside any existing rows for the scene version", async () => {
    const fixture = await createFixture();
    const first = await saveUploadedSceneImage({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      sceneId: fixture.sceneId,
      sceneVersionId: fixture.sceneVersionId,
      generationId: randomUUID(),
      size: "1536x1024",
      objectKey: `integration/${randomUUID()}.png`,
      contentType: "image/png",
      sizeBytes: 2048,
      width: 1536,
      height: 1024,
      etag: "etag-1",
      requestedByUserId: fixture.userId,
    });
    const second = await saveUploadedSceneImage({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      sceneId: fixture.sceneId,
      sceneVersionId: fixture.sceneVersionId,
      generationId: randomUUID(),
      size: "1024x1536",
      objectKey: `integration/${randomUUID()}.png`,
      contentType: "image/png",
      sizeBytes: 2048,
      width: 1024,
      height: 1536,
      etag: "etag-2",
      requestedByUserId: fixture.userId,
    });
    expect(second.generationVersion).toBe(first.generationVersion + 1);
  }, 30_000);

  it("saves a recorded scene narration with nulled AI-only fields and no reservation", async () => {
    const fixture = await createFixture();
    const generationId = randomUUID();
    const created = await saveRecordedSceneAudio({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      sceneId: fixture.sceneId,
      sceneVersionId: fixture.sceneVersionId,
      generationId,
      objectKey: `integration/${generationId}.webm`,
      contentType: "audio/webm",
      sizeBytes: 4096,
      etag: "etag-integration",
      durationMilliseconds: 5_400,
      narrationText: "An isolated integration-test narration.",
      requestedByUserId: fixture.userId,
    });
    expect(created.id).toBe(generationId);
    expect(created.source).toBe("user_recorded");
    expect(created.status).toBe("succeeded");
    expect(created.reviewStatus).toBe("pending");
    expect(created.estimatedCostCents).toBe(0);
    expect(created.format).toBe("webm");
    expect(created.voicePresetId).toBeNull();
    expect(created.provider).toBeNull();
    expect(created.inputCharacterCount).toBe(
      "An isolated integration-test narration.".length,
    );

    const approved = await approveSceneAudioGeneration({
      workspaceId: fixture.workspaceId,
      projectId: fixture.projectId,
      generationId,
      userId: fixture.userId,
    });
    expect(approved.reviewStatus).toBe("approved");
  }, 30_000);

  it("rejects a recorded narration with no audio bytes", async () => {
    const fixture = await createFixture();
    await expect(
      saveRecordedSceneAudio({
        workspaceId: fixture.workspaceId,
        projectId: fixture.projectId,
        sceneId: fixture.sceneId,
        sceneVersionId: fixture.sceneVersionId,
        generationId: randomUUID(),
        objectKey: `integration/${randomUUID()}.webm`,
        contentType: "audio/webm",
        sizeBytes: 0,
        etag: "etag-integration",
        durationMilliseconds: 1_000,
        narrationText: "An isolated integration-test narration.",
        requestedByUserId: fixture.userId,
      }),
    ).rejects.toThrow();
  }, 30_000);

  it("stays workspace-scoped: a generation from one workspace is not found in another", async () => {
    const first = await createFixture();
    const second = await createFixture();
    const generationId = randomUUID();
    await saveUploadedSceneImage({
      workspaceId: first.workspaceId,
      projectId: first.projectId,
      sceneId: first.sceneId,
      sceneVersionId: first.sceneVersionId,
      generationId,
      size: "1536x1024",
      objectKey: `integration/${generationId}.png`,
      contentType: "image/png",
      sizeBytes: 2048,
      width: 1536,
      height: 1024,
      etag: "etag-integration",
      requestedByUserId: first.userId,
    });
    const foundInOtherWorkspace = await findSceneImageGeneration({
      workspaceId: second.workspaceId,
      projectId: second.projectId,
      generationId,
    });
    expect(foundInOtherWorkspace).toBeNull();
    const foundInOwnWorkspace = await findSceneImageGeneration({
      workspaceId: first.workspaceId,
      projectId: first.projectId,
      generationId,
    });
    expect(foundInOwnWorkspace).not.toBeNull();
  }, 30_000);

  it("audio generation stays workspace-scoped too", async () => {
    const first = await createFixture();
    const second = await createFixture();
    const generationId = randomUUID();
    await saveRecordedSceneAudio({
      workspaceId: first.workspaceId,
      projectId: first.projectId,
      sceneId: first.sceneId,
      sceneVersionId: first.sceneVersionId,
      generationId,
      objectKey: `integration/${generationId}.webm`,
      contentType: "audio/webm",
      sizeBytes: 4096,
      etag: "etag-integration",
      durationMilliseconds: 5_000,
      narrationText: "An isolated integration-test narration.",
      requestedByUserId: first.userId,
    });
    const foundInOtherWorkspace = await findSceneAudioGeneration({
      workspaceId: second.workspaceId,
      projectId: second.projectId,
      generationId,
    });
    expect(foundInOtherWorkspace).toBeNull();
  }, 30_000);
});
