import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ find: vi.fn(), run: vi.fn(), fail: vi.fn() }));
vi.mock("@trigger.dev/sdk", () => ({ runs: { retrieve: m.run } }));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findMediaAsset: m.find,
}));
vi.mock("@/db/commands/media-inspection-commands", () => ({
  failMediaAssetInspection: m.fail,
}));
import { reconcileMediaInspection } from "./reconcile-media-inspection";
const input = { workspaceId: "workspace", mediaAssetId: "asset" };
const pending = {
  id: "asset",
  kind: "video",
  status: "pending",
  inspectionStatus: "pending",
  inspectionTriggerRunId: "run-original",
  deletedAt: null,
  updatedAt: new Date(Date.now() - 20 * 60_000),
};
beforeEach(() => {
  vi.clearAllMocks();
  m.find.mockResolvedValue(pending);
  m.run.mockResolvedValue({
    status: "CRASHED",
    error: { message: "TASK_PROCESS_OOM_KILLED private-details" },
  });
});
describe("reconciling a stopped inspection", () => {
  it("marks OOM as actionable failure using a run-bound guarded write", async () => {
    await reconcileMediaInspection(input);
    expect(m.find).toHaveBeenCalledWith(input);
    expect(m.fail).toHaveBeenCalledExactlyOnceWith({
      ...input,
      expectedRunId: "run-original",
      message:
        "Verification ran out of memory. Retry verification using the saved original.",
    });
  });
  it.each([
    "FAILED",
    "CANCELED",
    "TIMED_OUT",
    "EXPIRED",
    "SYSTEM_FAILURE",
    "COMPLETED",
  ])(
    "reconciles terminal %s without returning provider details",
    async (status) => {
      m.run.mockResolvedValue({ status });
      await reconcileMediaInspection(input);
      expect(m.fail).toHaveBeenCalledOnce();
      expect(JSON.stringify(m.fail.mock.calls)).not.toContain(
        "private-details",
      );
    },
  );
  it("leaves active work and ready assets untouched", async () => {
    m.run.mockResolvedValue({ status: "EXECUTING" });
    await reconcileMediaInspection(input);
    m.find.mockResolvedValue({
      ...pending,
      status: "ready",
      inspectionStatus: "succeeded",
    });
    await reconcileMediaInspection(input);
    expect(m.run).toHaveBeenCalledOnce();
    expect(m.fail).not.toHaveBeenCalled();
  });
  it("allows initial dispatch time but exposes an old missing-worker state", async () => {
    m.find.mockResolvedValue({
      ...pending,
      inspectionTriggerRunId: null,
      updatedAt: new Date(),
    });
    await reconcileMediaInspection(input);
    expect(m.fail).not.toHaveBeenCalled();
    m.find.mockResolvedValue({ ...pending, inspectionTriggerRunId: null });
    await reconcileMediaInspection(input);
    expect(m.fail).toHaveBeenCalledWith(
      expect.objectContaining({ expectedRunId: null }),
    );
    expect(m.run).not.toHaveBeenCalled();
  });
  it("does not change status when the worker API cannot be reached", async () => {
    m.run.mockRejectedValue(new Error("temporary outage"));
    await expect(reconcileMediaInspection(input)).rejects.toThrow(
      "temporary outage",
    );
    expect(m.fail).not.toHaveBeenCalled();
  });
});
