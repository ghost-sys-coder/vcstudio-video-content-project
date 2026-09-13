import { describe, expect, it } from "vitest";
import {
  createOpenAiVideoCapabilities,
  getOpenAiVideoDimensions,
  isRetriableOpenAiVideoError,
  toOpenAiVideoSeconds,
  toOpenAiVideoSize,
  toVideoGenerationStatus,
} from "@/lib/video-models/openai-video-mapping";
import { planSceneClip } from "@/lib/video-models/plan-scene-clip";

const capabilities = createOpenAiVideoCapabilities({ costCentsPerSecond: 30 });

describe("the shapes the API actually offers", () => {
  it("uses canvases that are exactly the render frame's shape", () => {
    // 1280x720 is exactly 16:9 and 720x1280 is exactly 9:16, so a clip fills
    // the frame with nothing cropped. The still image sizes do not manage this.
    const landscape = getOpenAiVideoDimensions(toOpenAiVideoSize("16:9")!);
    expect(landscape.width / landscape.height).toBeCloseTo(16 / 9, 5);
    const portrait = getOpenAiVideoDimensions(toOpenAiVideoSize("9:16")!);
    expect(portrait.width / portrait.height).toBeCloseTo(9 / 16, 5);
  });

  it("has no square canvas, and says so rather than substituting one", () => {
    expect(toOpenAiVideoSize("1:1")).toBeNull();
    expect(capabilities.aspectRatios).not.toContain("1:1");
  });

  it("refuses a square scene at planning time, before anything is spent", () => {
    const result = planSceneClip({
      capabilities,
      mode: "imageToVideo",
      aspectRatio: "1:1",
      sceneDurationMilliseconds: 30_000,
      hasApprovedStill: true,
    });
    expect(result.outcome).toBe("refused");
  });
});

describe("only asking for lengths the API sells", () => {
  it("passes the three it accepts, as the strings it wants", () => {
    expect(toOpenAiVideoSeconds(4)).toBe("4");
    expect(toOpenAiVideoSeconds(8)).toBe("8");
    expect(toOpenAiVideoSeconds(12)).toBe("12");
  });

  it("refuses anything else rather than rounding it", () => {
    // The planner is supposed to choose a sellable length. Rounding here would
    // hide a bug upstream while charging for the wrong clip.
    expect(toOpenAiVideoSeconds(7)).toBeNull();
    expect(toOpenAiVideoSeconds(0)).toBeNull();
    expect(toOpenAiVideoSeconds(20)).toBeNull();
  });

  it("only ever produces lengths the planner can translate", () => {
    // The two halves must agree, or a planned clip cannot be requested.
    for (const sceneSeconds of [3, 5, 9, 13, 30, 61]) {
      const plan = planSceneClip({
        capabilities,
        mode: "imageToVideo",
        aspectRatio: "16:9",
        sceneDurationMilliseconds: sceneSeconds * 1000,
        hasApprovedStill: true,
      });
      if (plan.outcome !== "planned") throw new Error("expected a plan");
      expect(toOpenAiVideoSeconds(plan.durationSeconds)).not.toBeNull();
    }
  });
});

describe("reading back what a job did", () => {
  const base = {
    progress: null,
    errorCode: null,
    mimeType: "video/mp4",
    durationSeconds: null,
    width: null,
    height: null,
    actualCostCents: null,
  };

  it("reports a queued job as running", () => {
    expect(toVideoGenerationStatus({ ...base, status: "queued" }).state).toBe(
      "running",
    );
  });

  it("carries the progress figure through while it runs", () => {
    const status = toVideoGenerationStatus({
      ...base,
      status: "in_progress",
      progress: 42,
    });
    if (status.state !== "running") throw new Error("expected running");
    expect(status.progressPercent).toBe(42);
  });

  it("converts the clip length to milliseconds on success", () => {
    const status = toVideoGenerationStatus({
      ...base,
      status: "completed",
      durationSeconds: 8,
    });
    if (status.state !== "succeeded") throw new Error("expected success");
    expect(status.durationMilliseconds).toBe(8000);
  });

  it("records no charge when the API reports none", () => {
    // The estimate then stands as the recorded cost, rather than a guess
    // dressed up as a measurement.
    const status = toVideoGenerationStatus({ ...base, status: "completed" });
    if (status.state !== "succeeded") throw new Error("expected success");
    expect(status.actualCostCents).toBeNull();
  });

  it("returns a failed job rather than throwing, since it is an outcome", () => {
    const status = toVideoGenerationStatus({
      ...base,
      status: "failed",
      errorCode: "moderation_blocked",
    });
    if (status.state !== "failed") throw new Error("expected failure");
    expect(status.code).toBe("moderation_blocked");
    expect(status.retriable).toBe(false);
  });
});

describe("deciding whether asking again could help", () => {
  it("retries the transient classes", () => {
    expect(isRetriableOpenAiVideoError("rate_limit_exceeded")).toBe(true);
    expect(isRetriableOpenAiVideoError("server_error")).toBe(true);
    expect(isRetriableOpenAiVideoError("service_unavailable")).toBe(true);
  });

  it("treats an unknown code as permanent", () => {
    // Retrying a billable request on a guess turns one bad prompt into a
    // repeated charge.
    expect(isRetriableOpenAiVideoError("something_new")).toBe(false);
    expect(isRetriableOpenAiVideoError(null)).toBe(false);
  });
});

describe("pricing", () => {
  it("takes the rate from configuration rather than writing one in", () => {
    // A published price is not something the code can know, and a stale number
    // would misprice every clip.
    expect(
      createOpenAiVideoCapabilities({ costCentsPerSecond: 55 })
        .costCentsPerSecond,
    ).toBe(55);
  });

  it("declares that the model returns sound, so the renderer can mute it", () => {
    expect(capabilities.producesAudio).toBe(true);
  });
});
