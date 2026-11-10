import { beforeEach, describe, expect, it, vi } from "vitest";
import { mcpOperationFixture } from "@/lib/test-utils/mcp-fixtures";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  list: vi.fn(),
  jobs: vi.fn(),
  update: vi.fn(),
  settle: vi.fn(),
  dispatch: vi.fn(),
  authorize: vi.fn(),
  status: vi.fn(),
}));
vi.mock("@/db/repositories/mcp-generation.repository", () => ({
  listMcpGenerationRecoveryOperations: m.list,
  listMcpGenerationJobs: m.jobs,
}));
vi.mock("@/db/repositories/mcp.repository", () => ({
  updateMcpOperation: m.update,
}));
vi.mock("@/db/commands/mcp-generation-commands", () => ({
  settleMcpGeneration: m.settle,
}));
vi.mock("./generation-service", () => ({
  dispatchMcpGeneration: m.dispatch,
  getMcpGenerationStatus: m.status,
}));
vi.mock("./context", () => ({ authorizeMcpBrowser: m.authorize }));
import { recoverMcpGenerations } from "./generation-recovery";
let op = mcpOperationFixture();
beforeEach(() => {
  vi.clearAllMocks();
  op = mcpOperationFixture({
    kind: "generate_media",
    status: "running",
    updatedAt: new Date(Date.now() - 40 * 60000),
    result: { providerSubmitted: true },
  });
  m.list.mockImplementation(async () => [
    { operation: op, reservedCostCents: 8, reservationStatus: "pending" },
  ]);
  m.update.mockResolvedValue(op);
  m.jobs.mockResolvedValue([]);
  m.dispatch.mockResolvedValue(op);
});
describe("MCP generation recovery preserves money and worker revisions", () => {
  it("conservatively settles a stale submitted worker without a paid retry", async () => {
    await recoverMcpGenerations();
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({
        from: ["running"],
        expectedUpdatedAt: op.updatedAt,
        values: expect.objectContaining({ status: "failed" }),
      }),
    );
    expect(m.settle).toHaveBeenCalledWith(op.workspaceId, op.id, 8);
    expect(m.dispatch).not.toHaveBeenCalled();
  });
  it("never refunds a stale queued snapshot if a worker started concurrently", async () => {
    op.status = "queued";
    op.expiresAt = new Date(0);
    op.result = null;
    m.update.mockResolvedValue(null);
    await recoverMcpGenerations();
    expect(m.settle).not.toHaveBeenCalled();
  });
  it("does not terminate a recently active worker at quote expiry", async () => {
    op.expiresAt = new Date(0);
    op.updatedAt = new Date();
    await recoverMcpGenerations();
    expect(m.update).not.toHaveBeenCalled();
    expect(m.settle).not.toHaveBeenCalled();
  });
  it("releases an expired request that never reached a provider", async () => {
    op.status = "queued";
    op.expiresAt = new Date(0);
    op.result = null;
    await recoverMcpGenerations();
    expect(m.settle).toHaveBeenCalledWith(op.workspaceId, op.id, 0);
  });
  it("settles successful output with its recorded actual cost", async () => {
    op.status = "succeeded";
    op.result = { providerSubmitted: true, actualCostCents: 3 };
    await recoverMcpGenerations();
    expect(m.settle).toHaveBeenCalledWith(op.workspaceId, op.id, 3);
    expect(m.update).not.toHaveBeenCalled();
  });
  it("keeps reservations pending when an outcome cannot be read", async () => {
    op.status = "queued";
    m.dispatch.mockRejectedValue(new Error("temporary read failure"));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await recoverMcpGenerations();
    expect(m.settle).not.toHaveBeenCalled();
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedUpdatedAt: op.updatedAt,
        values: { error: expect.stringContaining("Funds remain reserved") },
      }),
    );
    log.mockRestore();
  });
  it("records completed scene work even if its MCP expiry passed", async () => {
    op.expiresAt = new Date(0);
    m.list.mockResolvedValue([
      { operation: op, reservedCostCents: null, reservationStatus: null },
    ]);
    m.jobs.mockResolvedValue([
      {
        id: "generation",
        status: "succeeded",
        sceneId: "scene",
        projectId: "project",
        actualCostCents: 2,
        error: null,
      },
    ]);
    await recoverMcpGenerations();
    expect(m.update).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({
          status: "succeeded",
          result: expect.objectContaining({ generationId: "generation" }),
        }),
      }),
    );
    expect(m.settle).not.toHaveBeenCalled();
  });
});
