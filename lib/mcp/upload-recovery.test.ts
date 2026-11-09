import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  list: vi.fn(),
  remove: vi.fn(),
  clean: vi.fn(),
  abandoned: vi.fn(),
}));
vi.mock("@/db/repositories/mcp.repository", () => ({
  listMcpUploadChunkCleanup: m.list,
  markMcpUploadChunksCleaned: m.clean,
  listMcpAbandonedImports: m.abandoned,
  listMcpRecoveryOperations: vi.fn(),
  revokeExpiredMcpSecrets: vi.fn(),
  releaseAbandonedMcpPostLocks: vi.fn(),
  updateMcpOperation: vi.fn(),
}));
vi.mock("./chunk-upload-storage", () => ({ removeMcpChunks: m.remove }));
vi.mock("./publishing-service", () => ({
  dispatchApprovedPublication: vi.fn(),
}));
vi.mock("@/lib/env/server", () => ({
  getMcpEnvironment: () => ({ ENABLE_MCP: true }),
}));
import { cleanMcpImports } from "./recovery";
beforeEach(() => {
  vi.resetAllMocks();
  m.list.mockResolvedValue([
    { workspaceId: "workspace", id: "cancelled-upload" },
  ]);
  m.abandoned.mockResolvedValue([]);
});
describe("chunk retention extends existing cleanup only", () => {
  it("keeps dry-run cleanup read-only", async () => {
    expect(await cleanMcpImports(true)).toEqual({ cleaned: 1, dryRun: true });
    expect(m.remove).not.toHaveBeenCalled();
    expect(m.clean).not.toHaveBeenCalled();
  });
  it("cleans only selected terminal sessions and marks their staging separately", async () => {
    expect(await cleanMcpImports(false)).toEqual({ cleaned: 1, dryRun: false });
    expect(m.remove).toHaveBeenCalledExactlyOnceWith(
      "workspace",
      "cancelled-upload",
    );
    expect(m.clean).toHaveBeenCalledExactlyOnceWith(
      "workspace",
      "cancelled-upload",
    );
  });
  it("preserves cleanup eligibility after a failure and continues the existing run", async () => {
    m.remove.mockRejectedValue(new Error("offline"));
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await cleanMcpImports(false)).toEqual({ cleaned: 0, dryRun: false });
    expect(m.clean).not.toHaveBeenCalled();
    expect(m.abandoned).toHaveBeenCalledWith(25);
    logger.mockRestore();
  });
});
