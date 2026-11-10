import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpGenerationRequest } from "@studio/contracts/mcp-generation";
import type { McpOperation } from "@/db/repositories/mcp.repository";
import {
  mcpContextFixture,
  mcpIds,
  mcpOperationFixture,
} from "@/lib/test-utils/mcp-fixtures";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  begin: vi.fn(),
  find: vi.fn(),
  findKey: vi.fn(),
  update: vi.fn(),
  consume: vi.fn(),
  jobs: vi.fn(),
  reserve: vi.fn(),
  settle: vi.fn(),
  plan: vi.fn(),
  authorize: vi.fn(),
  trigger: vi.fn(),
  project: vi.fn(),
  scene: vi.fn(),
  image: vi.fn(),
  audio: vi.fn(),
}));
vi.mock("@trigger.dev/sdk", () => ({ tasks: { trigger: m.trigger } }));
vi.mock("@/db/repositories/mcp.repository", () => ({
  beginMcpOperation: m.begin,
  findMcpOperation: m.find,
  findMcpOperationByKey: m.findKey,
  updateMcpOperation: m.update,
}));
vi.mock("@/db/repositories/mcp-generation.repository", () => ({
  consumeMcpGeneration: m.consume,
  listMcpGenerationJobs: m.jobs,
}));
vi.mock("@/db/commands/mcp-generation-commands", () => ({
  reserveMcpGeneration: m.reserve,
  settleMcpGeneration: m.settle,
}));
vi.mock("./standalone-generation-plan", () => ({
  buildStandaloneGenerationPlan: m.plan,
}));
vi.mock("./reconcile-generation-worker", () => ({
  reconcileMcpGenerationWorker: async (op: unknown) => op,
}));
vi.mock("./context", () => ({ authorizeMcpBrowser: m.authorize }));
vi.mock("./project-access", () => ({ requireMcpProject: m.project }));
vi.mock("@/db/repositories/scenes.repository", () => ({
  findCurrentScene: m.scene,
}));
vi.mock("@/lib/scenes/start-scene-image-generation", () => ({
  startSceneImageGeneration: m.image,
  SceneImageGenerationRequestError: class extends Error {},
}));
vi.mock("@/lib/audio/start-scene-audio-generation", () => ({
  startSceneAudioGeneration: m.audio,
  SceneAudioGenerationRequestError: class extends Error {},
}));
vi.mock("@/lib/budgets/workspace-budget", () => ({
  loadEffectiveWorkspaceBudget: async () => ({
    dailyBudgetCents: 100,
    monthlyBudgetCents: 1000,
  }),
}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: vi.fn(),
}));
import {
  prepareMcpGeneration,
  executeMcpGeneration,
  approveMcpGeneration,
  getMcpGenerationStatus,
  assertMcpGenerationWorkerAccess,
} from "./generation-service";
import { McpError } from "./errors";
const request: McpGenerationRequest = {
  kind: "image",
  title: "Business post",
  prompt: "A quiet studio",
  size: "1024x1024",
  quality: "low",
  referenceAssetIds: [],
  maximumCostCents: 20,
};
const imagePlan = {
  kind: "image",
  estimatedCostCents: 5,
  promptTemplateVersion: "standalone-image-v1",
  configuration: {
    model: "test-image",
    prompt: request.prompt,
    quality: "low",
    size: "1024x1024",
    outputFormat: "png",
    outputCompression: 100,
    background: "opaque",
  },
  references: [],
  rates: {
    textInputCostPerMillionCents: 1,
    imageInputCostPerMillionCents: 1,
    outputCostPerMillionCents: 1,
  },
};
let ctx = mcpContextFixture(),
  current: McpOperation | null;
beforeEach(() => {
  vi.clearAllMocks();
  ctx = mcpContextFixture();
  current = null;
  m.plan.mockResolvedValue(imagePlan);
  m.jobs.mockResolvedValue([]);
  m.trigger.mockResolvedValue({ id: "run_test" });
  m.authorize.mockImplementation(async () => ctx);
  m.find.mockImplementation(async () => current);
  m.findKey.mockImplementation(async () => current);
  m.begin.mockImplementation(async (input) => {
    current = mcpOperationFixture({ ...input });
    return { created: true, operation: current };
  });
  m.update.mockImplementation(async ({ values }) => {
    if (!current) throw new Error("missing");
    current = { ...current, ...values };
    return current;
  });
  m.consume.mockImplementation(async () => {
    if (!current) throw new Error("missing");
    current = {
      ...current,
      status: "approved",
      approvalHash: null,
      expiresAt: new Date(Date.now() + 7200_000),
    };
    return current;
  });
});
async function prepare(autonomous = false) {
  ctx.grant.generationApprovalMode = autonomous ? "autonomous" : "manual";
  return prepareMcpGeneration(ctx, "generation-key-123", request);
}
describe("MCP exact-cost generation preparation and execution", () => {
  it("keeps a newer running worker's funds reserved if an older dispatch loses authorization", async () => {
    const p = await prepare(true);
    m.reserve.mockImplementationOnce(async () => {
      if (!current) throw new Error("missing");
      current.status = "running";
      throw new McpError("permission_denied", "Authorization changed");
    });
    m.update.mockImplementation(
      async ({
        from,
        values,
      }: {
        from: string[];
        values: Partial<McpOperation>;
      }) => {
        if (!current || !from.includes(current.status)) return null;
        current = { ...current, ...values };
        return current;
      },
    );
    expect(
      await executeMcpGeneration(ctx, p.operation.id, "generation-key-123"),
    ).toMatchObject({ status: "running" });
    expect(m.settle).not.toHaveBeenCalled();
  });
  it("retries an ambiguous queue handoff with the same operation and task key", async () => {
    const p = await prepare(true);
    m.trigger.mockRejectedValueOnce(new Error("handoff interrupted"));
    const first = await executeMcpGeneration(
      ctx,
      p.operation.id,
      "generation-key-123",
    );
    expect(first).toMatchObject({
      status: "approved",
      error: expect.stringContaining("SAME operation ID"),
    });
    expect(
      await executeMcpGeneration(ctx, p.operation.id, "generation-key-123"),
    ).toMatchObject({ status: "queued" });
    expect(m.trigger.mock.calls[0][2]).toEqual(m.trigger.mock.calls[1][2]);
    expect(m.settle).not.toHaveBeenCalled();
  });
  it("quotes and executes a current scene through the shared image service with a stable operation nonce", async () => {
    ctx.grant.generationApprovalMode = "autonomous";
    m.project.mockResolvedValue({ id: mcpIds.post });
    m.scene.mockResolvedValue({
      scene: { currentVersion: 1, status: "approved" },
      version: { id: mcpIds.asset },
    });
    const scenePlan = {
      configuration: imagePlan.configuration,
      sceneVersionId: mcpIds.asset,
      estimatedCostCents: 5,
      promptTemplateVersion: "scene-v1",
      referenceAssetIds: [],
      referenceRevisions: [],
    };
    m.image.mockImplementation(
      async (input: { inspectPlan?: (plan: unknown) => void }) => {
        input.inspectPlan?.(scenePlan);
        return { started: [], skippedSizes: [] };
      },
    );
    const sceneRequest: McpGenerationRequest = {
      kind: "scene_image",
      projectId: mcpIds.post,
      sceneId: mcpIds.destination,
      sceneVersionId: mcpIds.asset,
      expectedSceneVersion: 1,
      size: "1024x1024",
      quality: "low",
      stylePresetVersionId: mcpIds.asset,
      shotIndex: 0,
      referenceAssetIds: [],
      maximumCostCents: 20,
    };
    const prepared = await prepareMcpGeneration(
      ctx,
      "scene-generation-key",
      sceneRequest,
    );
    expect(m.image).toHaveBeenLastCalledWith(
      expect.objectContaining({ previewOnly: true }),
    );
    await executeMcpGeneration(
      ctx,
      prepared.operation.id,
      "scene-generation-key",
    );
    expect(m.image).toHaveBeenLastCalledWith(
      expect.objectContaining({
        mcpOperationId: prepared.operation.id,
        request: expect.objectContaining({
          requestNonce: prepared.operation.id,
          sceneVersionId: mcpIds.asset,
          sizes: ["1024x1024"],
        }),
      }),
    );
    expect(m.reserve).not.toHaveBeenCalled(); // the shared scene service owns its reservation
    m.scene.mockResolvedValue({
      scene: { currentVersion: 2, status: "approved" },
      version: { id: mcpIds.asset },
    });
    await expect(
      assertMcpGenerationWorkerAccess(ctx.workspaceId, prepared.operation.id),
    ).rejects.toThrow("scene changed");
  });
  it("rejects stale scene IDs/versions before preparing paid work", async () => {
    m.project.mockResolvedValue({ id: mcpIds.post });
    m.scene.mockResolvedValue({
      scene: { currentVersion: 2 },
      version: { id: mcpIds.asset },
    });
    await expect(
      prepareMcpGeneration(ctx, "stale-scene-request", {
        kind: "scene_audio",
        projectId: mcpIds.post,
        sceneId: mcpIds.destination,
        sceneVersionId: mcpIds.asset,
        expectedSceneVersion: 1,
        voicePresetId: mcpIds.asset,
        maximumCostCents: 10,
      }),
    ).rejects.toThrow("scene changed");
    expect(m.audio).not.toHaveBeenCalled();
    expect(m.begin).not.toHaveBeenCalled();
  });
  it("prepares a manual quote and keeps approval proof out of model-visible content", async () => {
    const result = await prepare();
    expect(result.operation.status).toBe("requires_approval");
    expect(result.uiProof).toHaveLength(64);
    expect(JSON.stringify(result.operation)).not.toContain(result.uiProof);
    expect(result.preview).toMatchObject({
      estimatedCostCents: 5,
      maximumCostCents: 20,
      text: request.prompt,
    });
    expect(m.reserve).not.toHaveBeenCalled();
    expect(m.trigger).not.toHaveBeenCalled();
  });
  it("prepares owner-authorized autonomy without granting it implicitly", async () => {
    const result = await prepare(true);
    expect(result.operation.status).toBe("prepared");
    expect(result.uiProof).toBeUndefined();
    expect(ctx.grant.publicationApprovalMode).toBe("manual");
  });
  it("rejects a quote above the caller's maximum without reserving", async () => {
    await expect(
      prepareMcpGeneration(ctx, "cost-key-123", {
        ...request,
        maximumCostCents: 1,
      }),
    ).rejects.toThrow("maximum cost");
    expect(m.begin).not.toHaveBeenCalled();
    expect(m.reserve).not.toHaveBeenCalled();
  });
  it("reuses an identical preparation but conflicts on changed inputs", async () => {
    const result = await prepare();
    expect((await prepare()).operation.id).toBe(result.operation.id);
    expect(m.begin).toHaveBeenCalledTimes(1);
    await expect(
      prepareMcpGeneration(ctx, "generation-key-123", {
        ...request,
        prompt: "Different",
      }),
    ).rejects.toThrow("different inputs");
  });
  it("refuses autonomous execution for a manual grant or a different key", async () => {
    const p = await prepare();
    await expect(
      executeMcpGeneration(ctx, p.operation.id, "generation-key-123"),
    ).rejects.toThrow("autonomous generation");
    ctx.grant.generationApprovalMode = "autonomous";
    await expect(
      executeMcpGeneration(ctx, p.operation.id, "another-key-123"),
    ).rejects.toThrow("same idempotency");
    expect(m.consume).not.toHaveBeenCalled();
  });
  it.each(["expiry", "grant", "content"])(
    "refuses a stale %s before consuming approval",
    async (change) => {
      const p = await prepare(true);
      if (!current) throw new Error("missing");
      if (change === "expiry") current.expiresAt = new Date(0);
      if (change === "grant")
        ctx.grant.updatedAt = new Date(ctx.grant.updatedAt.getTime() + 1);
      if (change === "content")
        m.plan.mockResolvedValue({ ...imagePlan, estimatedCostCents: 6 });
      await expect(
        executeMcpGeneration(ctx, p.operation.id, "generation-key-123"),
      ).rejects.toThrow();
      expect(m.consume).not.toHaveBeenCalled();
      expect(m.reserve).not.toHaveBeenCalled();
    },
  );
  it("lets an autonomous agent reserve and dispatch once, returning the same job on retry", async () => {
    const p = await prepare(true);
    const result = await executeMcpGeneration(
      ctx,
      p.operation.id,
      "generation-key-123",
    );
    expect(result.status).toBe("queued");
    expect(m.reserve).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: p.operation.id,
        estimatedCostCents: 5,
        maximumCostCents: 20,
        dailyBudgetCents: 100,
      }),
    );
    expect(m.trigger).toHaveBeenCalledWith(
      "mcp-image-generation",
      { operationId: p.operation.id, workspaceId: ctx.workspaceId },
      { idempotencyKey: `mcp-generation:${p.operation.id}` },
    );
    await executeMcpGeneration(ctx, p.operation.id, "generation-key-123");
    expect(m.trigger).toHaveBeenCalledTimes(1);
  });
  it("rejects model-supplied confirmations and replayed private proofs", async () => {
    const p = await prepare();
    await expect(
      approveMcpGeneration(ctx, p.operation.id, "confirmed:true"),
    ).rejects.toThrow("proof");
    await approveMcpGeneration(ctx, p.operation.id, p.uiProof);
    await expect(
      approveMcpGeneration(ctx, p.operation.id, p.uiProof),
    ).rejects.toThrow("proof");
    expect(m.consume).toHaveBeenCalledTimes(1);
  });
  it("uses a successful scene job to expose its exact generation and review state", async () => {
    const p = await prepare(true);
    if (!current) throw new Error("missing");
    current.status = "running";
    m.jobs.mockResolvedValue([
      {
        id: mcpIds.asset,
        kind: "scene_audio",
        projectId: mcpIds.post,
        sceneId: mcpIds.destination,
        status: "succeeded",
        reviewStatus: "pending",
        actualCostCents: 2,
        error: null,
      },
    ]);
    expect(await getMcpGenerationStatus(ctx, p.operation.id)).toMatchObject({
      status: "succeeded",
      result: { generationId: mcpIds.asset },
      jobs: [{ reviewStatus: "pending" }],
    });
  });
  it("rechecks worker authorization and rejects permission revisions before spending", async () => {
    const p = await prepare(true);
    if (!current) throw new Error("missing");
    current.status = "queued";
    ctx.connection.updatedAt = new Date(ctx.connection.updatedAt.getTime() + 1);
    await expect(
      assertMcpGenerationWorkerAccess(ctx.workspaceId, p.operation.id),
    ).rejects.toThrow("grant changed");
  });
});
