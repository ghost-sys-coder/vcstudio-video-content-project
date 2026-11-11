import { describe, expect, it, vi } from "vitest";
import type { ProductionRun, Project } from "@/db/schema";
import {
  executeProductionStep,
  type ProductionRunServices,
} from "@/lib/production-runs/execute-production-step";
import type { ProductionRunFacts } from "@/lib/production-runs/plan-production-step";
import { defaultProductionRunPolicy } from "@/lib/production-runs/production-run-policy";

const words = (count: number) =>
  Array.from({ length: count }, () => "word").join(" ");

function run(overrides: Partial<ProductionRun> = {}): ProductionRun {
  return {
    id: "run-1",
    workspaceId: "ws",
    projectId: "p",
    status: "running",
    stage: "script",
    policy: defaultProductionRunPolicy({ maximumCostCents: 300 }),
    attempts: {},
    stageReferences: {},
    spentCostCents: 0,
    holdReason: null,
    safeErrorMessage: null,
    triggerRunId: null,
    requestedByUserId: "user",
    startedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const project = { id: "p", status: "draft", aspectRatio: "16:9" } as Project;

function facts(
  overrides: Partial<ProductionRunFacts> = {},
): ProductionRunFacts {
  return {
    project: {
      id: "p",
      status: "draft",
      maximumBudgetCents: 1000,
      channelPlatform: null,
    },
    script: {
      approvedVersionId: null,
      draft: { content: "", revision: 1, updatedAt: new Date() },
      briefHasTopic: true,
      targetDurationSeconds: null,
      maximumCharacters: 20_000,
      generation: null,
    },
    scenes: { analysis: null, current: [], maximumScenes: 50 },
    images: { targetSize: "1536x1024", perScene: [] },
    audio: { voicePresetId: "v", perScene: [] },
    render: { own: null },
    release: {
      platform: "youtube",
      titles: null,
      hasTitleSuggestions: false,
      thumbnail: null,
      hasUsableThumbnail: false,
      packageId: null,
    },
    ...overrides,
  };
}

function services(input: { run: ProductionRun; facts: ProductionRunFacts }) {
  const state = { run: input.run };
  const calls: string[] = [];
  const fake: ProductionRunServices = {
    findRun: vi.fn(async () => state.run),
    findProject: vi.fn(async () => project),
    loadFacts: vi.fn(async () => input.facts),
    nonce: ({ stage, attempt }) => `${stage}-${attempt}`,
    startScriptGeneration: vi.fn(async () => {
      calls.push("startScriptGeneration");
      return { runId: "sg-1", estimatedCostCents: 3 };
    }),
    approveScript: vi.fn(async () => {
      calls.push("approveScript");
      return { versionId: "sv-1" };
    }),
    startSceneAnalysis: vi.fn(async () => ({
      analysisRunId: "a-1",
      estimatedCostCents: 2,
    })),
    approveAllScenes: vi.fn(async () => undefined),
    estimateImages: vi.fn(async ({ sceneCount }) => sceneCount * 100),
    startImages: vi.fn(async ({ sceneIds }) => {
      calls.push("startImages");
      return {
        batchId: "b-1",
        estimatedCostCents: sceneIds.length * 100,
        reservedCount: sceneIds.length,
      };
    }),
    approveImage: vi.fn(async () => {
      calls.push("approveImage");
    }),
    estimateAudio: vi.fn(async () => 5),
    startAudio: vi.fn(async () => ({
      estimatedCostCents: 5,
      reservedCount: 1,
    })),
    approveAudio: vi.fn(async () => undefined),
    startRender: vi.fn(async () => ({
      renderId: "r-1",
      estimatedCostCents: 10,
    })),
    startTitles: vi.fn(async () => ({ runId: "t-1", estimatedCostCents: 1 })),
    startThumbnail: vi.fn(async () => ({
      thumbnailGenerationId: "th-1",
      estimatedCostCents: 8,
    })),
    saveReleasePackage: vi.fn(async () => ({ releasePackageId: "pkg-1" })),
    updateCursor: vi.fn(async (update) => {
      state.run = {
        ...state.run,
        ...("stage" in update && update.stage ? { stage: update.stage } : {}),
        ...(update.attempts ? { attempts: update.attempts } : {}),
        ...(update.stageReferences
          ? { stageReferences: update.stageReferences }
          : {}),
        ...(update.spentCostCents !== undefined
          ? { spentCostCents: update.spentCostCents }
          : {}),
      };
      return state.run;
    }),
    hold: vi.fn(async ({ reason }) => {
      state.run = { ...state.run, status: "held", holdReason: reason };
      return state.run;
    }),
    finish: vi.fn(async ({ status, safeErrorMessage }) => {
      state.run = {
        ...state.run,
        status,
        safeErrorMessage: safeErrorMessage ?? null,
      };
      return state.run;
    }),
    appendEvent: vi.fn(async () => undefined),
    recordGates: vi.fn(async () => undefined),
    audit: vi.fn(async () => undefined),
  };
  return { fake, state, calls };
}

const scope = { workspaceId: "ws", runId: "run-1" };

describe("executeProductionStep", () => {
  it("refuses to act on a run that is not running", async () => {
    const { fake } = services({
      run: run({ status: "cancelled" }),
      facts: facts(),
    });
    expect(await executeProductionStep(fake, scope)).toEqual({
      kind: "stopped",
      status: "cancelled",
    });
    expect(fake.loadFacts).not.toHaveBeenCalled();
  });

  it("starts script generation, counts the attempt, remembers the run id and the spend", async () => {
    const { fake, state } = services({ run: run(), facts: facts() });
    expect(await executeProductionStep(fake, scope)).toEqual({
      kind: "continue",
    });
    expect(fake.startScriptGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ requestNonce: "script-1" }),
    );
    expect(state.run.attempts).toEqual({ script: 1 });
    expect(state.run.stageReferences).toEqual({
      scriptGenerationRunId: "sg-1",
    });
    expect(state.run.spentCostCents).toBe(3);
    expect(fake.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "stage_started" }),
    );
  });

  it("waits while a stage it started is still running", async () => {
    const generation = {
      id: "sg-1",
      status: "running" as const,
      generatedContent: null,
      completedAt: null,
      safeErrorMessage: null,
    };
    const { fake } = services({
      run: run({ stageReferences: { scriptGenerationRunId: "sg-1" } }),
      facts: facts({ script: { ...facts().script, generation } }),
    });
    const outcome = await executeProductionStep(fake, scope);
    expect(outcome.kind).toBe("wait");
    expect(fake.startScriptGeneration).not.toHaveBeenCalled();
  });

  it("approves a passing script and records the gate as accepted", async () => {
    const generation = {
      id: "sg-1",
      status: "completed" as const,
      generatedContent: words(200),
      completedAt: new Date(),
      safeErrorMessage: null,
    };
    const { fake } = services({
      run: run(),
      facts: facts({ script: { ...facts().script, generation } }),
    });
    expect(await executeProductionStep(fake, scope)).toEqual({
      kind: "continue",
    });
    expect(fake.approveScript).toHaveBeenCalledWith(
      expect.objectContaining({ content: words(200), draftRevision: 1 }),
    );
    expect(fake.recordGates).toHaveBeenCalledWith(
      expect.objectContaining({
        results: [
          expect.objectContaining({ subject: "script", accepted: true }),
        ],
      }),
    );
  });

  it("holds and records the failing gate instead of approving", async () => {
    const generation = {
      id: "sg-1",
      status: "completed" as const,
      generatedContent: words(10),
      completedAt: new Date(),
      safeErrorMessage: null,
    };
    const { fake, state } = services({
      run: run(),
      facts: facts({ script: { ...facts().script, generation } }),
    });
    expect(await executeProductionStep(fake, scope)).toEqual({
      kind: "stopped",
      status: "held",
    });
    expect(fake.approveScript).not.toHaveBeenCalled();
    expect(fake.recordGates).toHaveBeenCalledWith(
      expect.objectContaining({
        results: [
          expect.objectContaining({ verdict: "fail", accepted: false }),
        ],
      }),
    );
    expect(state.run.holdReason).toContain("did not pass");
    expect(fake.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "production_run_held" }),
    );
  });

  it("advances to the next stage and logs both the completion and the start", async () => {
    const { fake, state } = services({
      run: run(),
      facts: facts({ script: { ...facts().script, approvedVersionId: "sv" } }),
    });
    expect(await executeProductionStep(fake, scope)).toEqual({
      kind: "continue",
    });
    expect(state.run.stage).toBe("scenes");
    const kinds = (fake.appendEvent as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[0].kind,
    );
    expect(kinds).toEqual(["stage_completed", "stage_started"]);
  });

  it("refuses an image batch that would pass the run's ceiling and holds", async () => {
    const perScene = [1, 2, 3, 4].map((n) => ({
      sceneId: `s${n}`,
      sceneNumber: n,
      latest: null,
    }));
    const { fake, state } = services({
      run: run({ stage: "images", spentCostCents: 0 }),
      facts: facts({ images: { targetSize: "1536x1024", perScene } }),
    });
    expect(await executeProductionStep(fake, scope)).toEqual({
      kind: "stopped",
      status: "held",
    });
    expect(fake.startImages).not.toHaveBeenCalled();
    expect(fake.appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "budget_refused" }),
    );
    expect(state.run.holdReason).toContain("$4.00");
  });

  it("starts an affordable image batch and tracks the batch id", async () => {
    const perScene = [{ sceneId: "s1", sceneNumber: 1, latest: null }];
    const { fake, state } = services({
      run: run({ stage: "images" }),
      facts: facts({ images: { targetSize: "1536x1024", perScene } }),
    });
    expect(await executeProductionStep(fake, scope)).toEqual({
      kind: "continue",
    });
    expect(state.run.stageReferences).toEqual({ imageBatchIds: ["b-1"] });
    expect(state.run.spentCostCents).toBe(100);
  });

  it("approves every pending image that passed its gate", async () => {
    const good = (id: string) => ({
      id,
      status: "succeeded",
      reviewStatus: "pending",
      assetObjectKey: "k",
      assetWidth: 1536,
      assetHeight: 1024,
      safeErrorMessage: null,
    });
    const perScene = [
      { sceneId: "s1", sceneNumber: 1, latest: good("g1") },
      { sceneId: "s2", sceneNumber: 2, latest: good("g2") },
    ];
    const { fake } = services({
      run: run({ stage: "images" }),
      facts: facts({ images: { targetSize: "1536x1024", perScene } }),
    });
    expect(await executeProductionStep(fake, scope)).toEqual({
      kind: "continue",
    });
    expect(fake.approveImage).toHaveBeenCalledTimes(2);
  });

  it("turns a stage request error into a hold that names the stage", async () => {
    const { fake, state } = services({
      run: run({ stage: "render" }),
      facts: facts(),
    });
    const error = new Error("The timeline is not ready to render.");
    error.name = "VideoRenderTimelineInvalidError";
    Object.assign(error, {
      issues: [{ sceneNumber: 2, message: "Scene 2 has no approved image." }],
    });
    (fake.startRender as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
    expect(await executeProductionStep(fake, scope)).toEqual({
      kind: "stopped",
      status: "held",
    });
    expect(state.run.holdReason).toBe(
      "Render: The timeline is not ready to render. Scene 2 has no approved image.",
    );
  });

  it("backs off on a rate limit without consuming an attempt", async () => {
    const { fake, state } = services({
      run: run({ stage: "render" }),
      facts: facts(),
    });
    const error = Object.assign(new Error("Too many requests."), {
      code: "RATE_LIMIT_EXCEEDED",
    });
    (fake.startRender as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);
    const outcome = await executeProductionStep(fake, scope);
    expect(outcome.kind).toBe("wait");
    expect(state.run.attempts).toEqual({});
  });

  it("rethrows unknown errors so the worker records a failure", async () => {
    const { fake } = services({
      run: run({ stage: "render" }),
      facts: facts(),
    });
    (fake.startRender as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("boom"),
    );
    await expect(executeProductionStep(fake, scope)).rejects.toThrow("boom");
  });

  it("saves the release package and then finishes ready for review", async () => {
    const release = {
      platform: "youtube" as const,
      titles: null,
      hasTitleSuggestions: true,
      thumbnail: null,
      hasUsableThumbnail: true,
      packageId: null,
    };
    const { fake, state } = services({
      run: run({ stage: "release", spentCostCents: 123 }),
      facts: facts({ release }),
    });
    expect(await executeProductionStep(fake, scope)).toEqual({
      kind: "continue",
    });
    expect(state.run.stageReferences).toEqual({ releasePackageId: "pkg-1" });

    (fake.loadFacts as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      facts({ release: { ...release, packageId: "pkg-1" } }),
    );
    expect(await executeProductionStep(fake, scope)).toEqual({
      kind: "stopped",
      status: "ready_for_review",
    });
    expect(state.run.status).toBe("ready_for_review");
    expect(fake.audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "production_run_ready" }),
    );
  });
});
