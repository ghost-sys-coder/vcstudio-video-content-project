import { beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  update: vi.fn(),
  settle: vi.fn(),
}));
vi.mock("@/db/repositories/video-generations.repository", () => ({
  listExpiredVideoReservations: mocks.list,
}));
vi.mock("@/db/commands/video-generation-commands", () => ({
  updateVideoGeneration: mocks.update,
  settleVideoGeneration: mocks.settle,
}));
import { recoverVideoOperations } from "./video-recovery";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue([]);
  mocks.update.mockResolvedValue({ id: "job" });
  mocks.settle.mockResolvedValue(undefined);
});
describe("existing-sweep video recovery", () => {
  it("releases only expired queued work that was never submitted", async () => {
    mocks.list.mockResolvedValue([
      {
        id: "job",
        workspaceId: "workspace",
        status: "queued",
        attemptCount: 0,
        actualCostCents: null,
      },
    ]);
    expect(await recoverVideoOperations()).toEqual({ recovered: 1 });
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        from: ["queued"],
        values: expect.objectContaining({ status: "cancelled" }),
      }),
    );
    expect(mocks.settle).toHaveBeenCalledWith({
      workspaceId: "workspace",
      generationId: "job",
      actualCostCents: 0,
    });
  });
  it("does not refund an expired queued job after a worker wins the claim", async () => {
    mocks.list.mockResolvedValue([
      {
        id: "job",
        workspaceId: "workspace",
        status: "queued",
        attemptCount: 0,
        actualCostCents: null,
      },
    ]);
    mocks.update.mockResolvedValue(null);
    await recoverVideoOperations();
    expect(mocks.settle).not.toHaveBeenCalled();
  });
  it("retains possibly-billed work for explicit reconciliation without starting tasks", async () => {
    mocks.list.mockResolvedValue(
      ["submitting", "running", "inspecting"].map((status, index) => ({
        id: `job-${index}`,
        workspaceId: "workspace",
        status,
        attemptCount: 1,
        actualCostCents: null,
      })),
    );
    expect(await recoverVideoOperations()).toEqual({ recovered: 3 });
    expect(mocks.settle).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        values: expect.objectContaining({ status: "requires_reconciliation" }),
      }),
    );
  });
  it("settles a completed measured cost after a worker crash without generating again", async () => {
    mocks.list.mockResolvedValue([
      {
        id: "job",
        workspaceId: "workspace",
        status: "succeeded",
        attemptCount: 1,
        actualCostCents: 42,
      },
    ]);
    await recoverVideoOperations();
    expect(mocks.settle).toHaveBeenCalledWith({
      workspaceId: "workspace",
      generationId: "job",
      actualCostCents: 42,
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
