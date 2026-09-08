import type { Scene, SceneVersion } from "@/db/schema";
import type { SceneContent } from "@/lib/schemas/scene";
import { sceneContentSchema } from "@/lib/schemas/scene";
import { buildVideoTimeline } from "@/lib/timeline/video-timeline";
import type { TimelineSceneAssetInput } from "@/lib/timeline/video-timeline";
import type { ShortClipDefinition } from "@/lib/shorts/short-timeline";
import { assembleSubtitleTrack } from "@/lib/subtitles/subtitle-track";
import { toRemotionCaptions } from "@/lib/subtitles/remotion-captions";

// Synthetic test records only: these IDs and object keys must never be seeded
// into an existing user project. Durations are fixture inputs, not measurements.
export const BASELINE_SCOPE = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  projectId: "00000000-0000-4000-8000-000000000002",
  userId: "00000000-0000-4000-8000-000000000003",
};

function fixtureId(group: number, index: number): string {
  return `${String(group).padStart(8, "0")}-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

export function createProductionBaselineFixture(
  options: {
    sceneDurationMilliseconds?: number;
    sceneCopy?: (
      sceneNumber: number,
    ) => Pick<SceneContent, "narrationText" | "visualDescription">;
  } = {},
) {
  const sceneDurationMilliseconds = options.sceneDurationMilliseconds ?? 12_000;
  const createdAt = new Date("2026-09-08T00:00:00.000Z");
  const rows = Array.from({ length: 40 }, (_, index) => {
    const sceneNumber = index + 1;
    const sceneId = fixtureId(1, sceneNumber);
    const versionId = fixtureId(2, sceneNumber);
    const content: SceneContent = sceneContentSchema.parse({
      narrationText: `This is synthetic production sample ${sceneNumber}. Review the source before approving the final video.`,
      visualDescription: `An illustrated notebook showing sample ${sceneNumber}.`,
      locationDescription: "A quiet studio desk.",
      actionDescription: "A notebook rests beside a pencil.",
      cameraShot: "medium",
      cameraAngle: "eye level",
      cameraMotion: "zoomIn",
      emotionalTone: "calm",
      characterNames: [],
      propNames: ["notebook", "pencil"],
      continuityNotes: "Keep the same desk and notebook.",
      estimatedDurationMilliseconds: sceneDurationMilliseconds,
      ...options.sceneCopy?.(sceneNumber),
    });
    const scene: Scene = {
      id: sceneId,
      workspaceId: BASELINE_SCOPE.workspaceId,
      projectId: BASELINE_SCOPE.projectId,
      scriptVersionId: fixtureId(3, 1),
      analysisRunId: fixtureId(4, 1),
      sceneNumber,
      status: "approved",
      currentVersion: 1,
      createdAt,
      updatedAt: createdAt,
    };
    const version: SceneVersion = {
      ...content,
      id: versionId,
      workspaceId: BASELINE_SCOPE.workspaceId,
      projectId: BASELINE_SCOPE.projectId,
      sceneId,
      versionNumber: 1,
      startTimeMilliseconds: index * sceneDurationMilliseconds,
      endTimeMilliseconds: sceneNumber * sceneDurationMilliseconds,
      createdByUserId: BASELINE_SCOPE.userId,
      createdAt,
    };
    return { scene, version };
  });
  const prefix = `workspaces/${BASELINE_SCOPE.workspaceId}/projects/${BASELINE_SCOPE.projectId}/baseline`;
  const assets: TimelineSceneAssetInput[] = rows.map(({ scene, version }) => ({
    sceneId: scene.id,
    sceneVersionId: version.id,
    sceneNumber: scene.sceneNumber,
    sceneApproved: true,
    expectedDurationMilliseconds: sceneDurationMilliseconds,
    cameraMotion: "zoomIn",
    transition: "cut",
    image: {
      generationId: fixtureId(5, scene.sceneNumber),
      objectKey: `${prefix}/${scene.id}.webp`,
      width: 1536,
      height: 1024,
      framing: {
        mode: "cover",
        focalPointXBps: scene.sceneNumber === 3 ? 6500 : 5000,
        focalPointYBps: 5000,
        scaleBps: 10000,
        backgroundColor: "#000000",
      },
    },
    audio: {
      generationId: fixtureId(6, scene.sceneNumber),
      objectKey: `${prefix}/${scene.id}.mp3`,
      durationMilliseconds: sceneDurationMilliseconds,
      format: "mp3",
    },
  }));
  const renderSettings = {
    width: 1920,
    height: 1080,
    framesPerSecond: 30,
    paddingMilliseconds: 250,
  };
  const captionsBySceneId = Object.fromEntries(
    rows.map(({ scene, version }, index) => {
      const startMilliseconds = index * (sceneDurationMilliseconds + 250);
      const track = assembleSubtitleTrack(
        [
          {
            sceneId: scene.id,
            sceneNumber: scene.sceneNumber,
            sceneVersionId: version.id,
            narrationText: version.narrationText,
            startMilliseconds,
            endMilliseconds: startMilliseconds + sceneDurationMilliseconds,
          },
        ],
        {
          granularity: "sentence",
          framesPerSecond: 30,
          maxLineCharacters: 42,
          minSegmentDurationMilliseconds: 500,
          textOverrides:
            scene.sceneNumber === 3
              ? { [`${version.id}:0`]: "An edited fixture caption." }
              : {},
        },
      );
      return [scene.id, toRemotionCaptions(track)];
    }),
  );
  const timelineInput = {
    scenes: assets,
    renderSettings,
    captionsBySceneId,
    durationMismatchToleranceMilliseconds: 1500,
  };
  const result = buildVideoTimeline(timelineInput);
  if (result.status !== "ready")
    throw new Error("Invalid production baseline fixture.");
  const clips: ShortClipDefinition[] = result.timeline.scenes
    .slice(2, 6)
    .map((scene, index) => ({
      id: fixtureId(7, index + 1),
      sourceSceneId: scene.sceneId,
      sourceSceneVersionId: scene.sceneVersionId,
      position: index + 1,
      sourceStartMilliseconds: scene.startMilliseconds,
      sourceEndMilliseconds: scene.endMilliseconds - (index === 3 ? 3000 : 0),
      transition: "cut",
    }));
  return { rows, timelineInput, timeline: result.timeline, clips };
}
