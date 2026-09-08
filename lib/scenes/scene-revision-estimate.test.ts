import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BASELINE_SCOPE,
  createProductionBaselineFixture,
} from "@/lib/test-utils/version-two-production-fixture";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  current: vi.fn(),
  images: vi.fn(),
  audio: vi.fn(),
  image: vi.fn(),
  voice: vi.fn(),
  style: vi.fn(),
  assigned: vi.fn(),
  references: vi.fn(),
  eligible: vi.fn(),
}));
vi.mock("@/db/repositories/scenes.repository", () => ({
  findCurrentScene: mocks.current,
}));
vi.mock("@/db/repositories/subtitle.repository", () => ({
  listApprovedSceneImageAssets: mocks.images,
  listApprovedSceneAudioAssets: mocks.audio,
}));
vi.mock("@/db/repositories/scene-images.repository", () => ({
  findSceneImageGeneration: mocks.image,
  findStylePresetVersion: mocks.style,
  listAssignedSceneCharacters: mocks.assigned,
  listGenerationReferenceAssets: mocks.references,
  findEligibleSceneReferenceAssetsByIds: mocks.eligible,
}));
vi.mock("@/db/repositories/scene-audio.repository", () => ({
  findSceneAudioGeneration: mocks.voice,
}));
vi.mock("@/lib/env/server", () => ({
  getSceneAudioEnvironment: () => ({
    MAX_NARRATION_CHARACTERS: 4000,
    OPENAI_TTS_COST_PER_MILLION_CHARACTERS_CENTS: 1500,
    OPENAI_TTS_MINIMUM_ESTIMATE_CENTS: 1,
  }),
  getSceneImageEnvironment: () => ({
    OPENAI_IMAGE_MODEL: "test-model",
    OPENAI_IMAGE_LOW_SQUARE_ESTIMATE_CENTS: 2,
    OPENAI_IMAGE_LOW_RECTANGULAR_ESTIMATE_CENTS: 3,
    OPENAI_IMAGE_MEDIUM_SQUARE_ESTIMATE_CENTS: 4,
    OPENAI_IMAGE_MEDIUM_RECTANGULAR_ESTIMATE_CENTS: 5,
    OPENAI_IMAGE_HIGH_SQUARE_ESTIMATE_CENTS: 6,
    OPENAI_IMAGE_HIGH_RECTANGULAR_ESTIMATE_CENTS: 7,
    OPENAI_IMAGE_TEXT_INPUT_COST_PER_MILLION_CENTS: 500,
    OPENAI_IMAGE_REFERENCE_RESERVE_CENTS_PER_ASSET: 2,
  }),
}));
import { estimateSceneRevision } from "./scene-revision-estimate";

function input() {
  const row = createProductionBaselineFixture().rows[0]!;
  mocks.current.mockResolvedValue(row);
  return {
    workspaceId: BASELINE_SCOPE.workspaceId,
    project: {
      id: BASELINE_SCOPE.projectId,
      videoKind: "staticImages" as const,
    },
    revision: {
      ...row.version,
      projectId: BASELINE_SCOPE.projectId,
      sceneId: row.scene.id,
      expectedVersion: 1,
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.images.mockResolvedValue([]);
  mocks.audio.mockResolvedValue([]);
  mocks.assigned.mockResolvedValue([]);
  mocks.references.mockResolvedValue([]);
});
describe("scene revision planning estimates", () => {
  it("does not charge retained media and scopes all lookups", async () => {
    const request = input();
    const result = await estimateSceneRevision(request);
    expect(result.estimatedCostCents).toBe(0);
    expect(mocks.image).not.toHaveBeenCalled();
    expect(mocks.voice).not.toHaveBeenCalled();
    expect(mocks.current).toHaveBeenCalledWith({
      workspaceId: request.workspaceId,
      projectId: request.project.id,
      sceneId: request.revision.sceneId,
    });
    expect(mocks.images).toHaveBeenCalledTimes(3);
  });
  it("uses normalized replacement narration length and current rates", async () => {
    const request = input();
    request.revision.narrationText = "word ".repeat(400);
    mocks.audio.mockResolvedValue([{ generationId: "audio" }]);
    mocks.voice.mockResolvedValue({ source: "ai_generated" });
    const result = await estimateSceneRevision(request);
    expect(result.estimatedCostCents).toBe(3);
    expect(result.lines[0]).toContain("1999 characters");
  });
  it("estimates changed visuals from the current prompt and original quality/style", async () => {
    const request = input();
    request.revision.visualDescription = "Updated visual.";
    mocks.images.mockImplementation(async ({ size }: { size: string }) =>
      size === "1536x1024" ? [{ generationId: "image" }] : [],
    );
    mocks.image.mockResolvedValue({
      id: "image",
      source: "ai_generated",
      size: "1536x1024",
      quality: "medium",
      stylePresetVersionId: "style",
    });
    mocks.style.mockResolvedValue({
      preset: { id: "style", isDefault: true },
      version: {
        id: "version",
        name: "Simple",
        description: "Simple stills",
        version: 1,
        positivePrompt: "Clear composition",
        negativePrompt: "No clutter",
        defaultAspectRatio: "16:9",
      },
    });
    const result = await estimateSceneRevision(request);
    expect(result.estimatedCostCents).toBeGreaterThanOrEqual(6);
    expect(result.lines[0]).toContain("medium quality, Simple");
    expect(result.unavailableCount).toBe(0);
  });
  it("marks uploaded replacements as unpriced rather than free generation", async () => {
    const request = input();
    request.revision.visualDescription = "Updated visual.";
    mocks.images.mockResolvedValueOnce([{ generationId: "image" }]);
    mocks.image.mockResolvedValue({
      source: "user_uploaded",
      size: "1536x1024",
    });
    const result = await estimateSceneRevision(request);
    expect(result.unavailableCount).toBe(1);
    expect(result.lines[0]).toContain("not estimated");
  });
  it("keeps image replacement out of a narration-only estimate", async () => {
    const request = input();
    request.revision.narrationText = "Revised narration.";
    mocks.images.mockResolvedValueOnce([{ generationId: "kept-image" }]);
    await estimateSceneRevision(request);
    expect(mocks.image).not.toHaveBeenCalled();
  });
  it("reports an unavailable style as an incomplete estimate", async () => {
    const request = input();
    request.revision.visualDescription = "Revised visual.";
    mocks.images.mockResolvedValueOnce([{ generationId: "image" }]);
    mocks.image.mockResolvedValue({
      id: "image",
      source: "ai_generated",
      size: "1536x1024",
      quality: "medium",
      stylePresetVersionId: "removed",
    });
    mocks.style.mockResolvedValue(null);
    expect((await estimateSceneRevision(request)).unavailableCount).toBe(1);
  });
  it("reports narration over the provider limit without losing the edit", async () => {
    const request = input();
    request.revision.narrationText = "a".repeat(4001);
    mocks.audio.mockResolvedValue([{ generationId: "audio" }]);
    mocks.voice.mockResolvedValue({ source: "ai_generated" });
    const result = await estimateSceneRevision(request);
    expect(result.unavailableCount).toBe(1);
    expect(result.lines[0]).toContain("exceeds");
  });
  it("does not price a recorded voice as automatic speech generation", async () => {
    const request = input();
    request.revision.narrationText = "Revised narration.";
    mocks.audio.mockResolvedValue([{ generationId: "audio" }]);
    mocks.voice.mockResolvedValue({ source: "user_recorded" });
    const result = await estimateSceneRevision(request);
    expect(result.unavailableCount).toBe(1);
    expect(result.lines[0]).toContain("record or upload");
  });
  it("rejects stale versions and missing tenant-scoped scenes before reading assets", async () => {
    const request = input();
    request.revision.expectedVersion = 2;
    await expect(estimateSceneRevision(request)).rejects.toThrow(
      "SCENE_REVISION_CONFLICT",
    );
    mocks.current.mockResolvedValue(null);
    await expect(estimateSceneRevision(request)).rejects.toThrow(
      "SCENE_REVISION_CONFLICT",
    );
    expect(mocks.images).not.toHaveBeenCalled();
  });
});
