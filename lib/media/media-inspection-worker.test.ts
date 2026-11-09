import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
type Context = { ctx: { run: { id: string } } };
const capture = vi.hoisted(() => {
  const handlers: {
    run?: (payload: unknown, context: Context) => Promise<unknown>;
    failure?: (context: {
      payload: unknown;
      ctx: { run: { id: string } };
    }) => Promise<void>;
  } = {};
  return {
    handlers,
    find: vi.fn(),
    attach: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
    inspect: vi.fn(),
    extract: vi.fn(),
    save: vi.fn(),
    file: vi.fn(),
  };
});
vi.mock("@trigger.dev/sdk", () => ({
  task: (definition: {
    run: NonNullable<typeof capture.handlers.run>;
    onFailure: NonNullable<typeof capture.handlers.failure>;
  }) => {
    capture.handlers.run = definition.run;
    capture.handlers.failure = definition.onFailure;
    return {};
  },
}));
vi.mock("@/db/commands/media-inspection-commands", () => ({
  attachMediaAssetInspectionRun: capture.attach,
  completeMediaAssetInspection: capture.complete,
  failMediaAssetInspection: capture.fail,
  saveMediaAssetThumbnail: capture.save,
  completeRecordedAudioInspection: vi.fn(),
  failRecordedAudioInspection: vi.fn(),
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findMediaAsset: capture.find,
}));
vi.mock("@/db/repositories/scene-audio.repository", () => ({
  findSceneAudioGeneration: vi.fn(),
}));
vi.mock("@/lib/env/server", () => ({
  getSceneAudioEnvironment: () => ({
    FFPROBE_PATH: "probe",
    FFMPEG_PATH: "ffmpeg",
  }),
  getMediaLibraryEnvironment: () => ({
    MAX_MEDIA_VIDEO_BYTES: 512 * 1024 * 1024,
    MAX_MEDIA_VIDEO_DURATION_SECONDS: 1800,
  }),
}));
vi.mock("@/lib/media/inspect-media-file", () => ({
  inspectMediaFile: capture.inspect,
}));
vi.mock("@/lib/media/extract-video-thumbnail", () => ({
  extractVideoThumbnail: capture.extract,
}));
vi.mock("@/lib/storage/with-media-asset-file", () => ({
  withMediaAssetFile: capture.file,
}));
vi.mock("@/lib/storage/scene-audio-storage", () => ({
  downloadSceneAudioBytes: vi.fn(),
}));
vi.mock("@/lib/media/store-video-thumbnail", () => ({
  storeVideoThumbnail: vi.fn(),
}));
vi.mock("@/lib/media/run-media-asset-thumbnail", () => ({
  runMediaAssetThumbnail: vi.fn(),
}));
import "@/trigger/media-inspection";
const payload = {
  kind: "media_asset",
  workspaceId: "11111111-1111-4111-8111-111111111111",
  mediaAssetId: "22222222-2222-4222-8222-222222222222",
};
const ctx = { ctx: { run: { id: "run-current" } } };
beforeEach(() => {
  vi.clearAllMocks();
  capture.find.mockResolvedValue({
    id: payload.mediaAssetId,
    status: "pending",
    kind: "video",
    inspectionStatus: "pending",
    contentType: "video/mp4",
    objectKey: "private",
    sizeBytes: 300 * 1024 * 1024,
  });
  capture.attach.mockResolvedValue(true);
  capture.file.mockImplementation(
    async (_input: unknown, use: (path: string) => Promise<unknown>) =>
      use("/temporary/source.mp4"),
  );
  capture.inspect.mockResolvedValue({
    metadata: { kind: "video", durationMilliseconds: 600000 },
    warnings: [],
  });
});
describe("large-video worker sequencing", () => {
  it("commits readiness before optional thumbnail work and keeps it when that work fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    capture.extract.mockImplementation(async () => {
      expect(capture.complete).toHaveBeenCalledOnce();
      throw new Error("thumbnail decoder failed");
    });
    if (!capture.handlers.run) throw new Error("task not registered");
    await expect(capture.handlers.run(payload, ctx)).resolves.toMatchObject({
      status: "succeeded",
    });
    expect(capture.inspect).toHaveBeenCalledWith({
      sourcePath: "/temporary/source.mp4",
      expectedKind: "video",
      ffprobePath: "probe",
      ffmpegPath: "ffmpeg",
    });
    expect(capture.fail).not.toHaveBeenCalled();
    warn.mockRestore();
  });
  it("does not reopen an already-released video or a competing run", async () => {
    if (!capture.handlers.run) throw new Error("task not registered");
    capture.find.mockResolvedValueOnce({ inspectionStatus: "succeeded" });
    await capture.handlers.run(payload, ctx);
    capture.attach.mockResolvedValue(false);
    await capture.handlers.run(payload, ctx);
    expect(capture.file).not.toHaveBeenCalled();
  });
  it("records a terminal hook failure against only its own run and ignores thumbnail-only failures", async () => {
    if (!capture.handlers.failure) throw new Error("failure hook missing");
    await capture.handlers.failure({ payload, ...ctx });
    expect(capture.fail).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRunId: "run-current",
        workspaceId: payload.workspaceId,
      }),
    );
    capture.fail.mockClear();
    await capture.handlers.failure({
      payload: { ...payload, kind: "video_thumbnail" },
      ...ctx,
    });
    expect(capture.fail).not.toHaveBeenCalled();
  });
});
