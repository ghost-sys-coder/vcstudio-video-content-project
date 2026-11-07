import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  begin: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@/db/repositories/mcp.repository", () => ({
  beginMcpOperation: mocks.begin,
  updateMcpOperation: mocks.update,
}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: mocks.audit,
}));
import { mutateOnce, publicOperation } from "./operations";
import { fingerprint } from "./fingerprint";
import type { McpContext } from "./context";
import type { McpOperation } from "@/db/repositories/mcp.repository";
const context: McpContext = {
  workspaceId: "workspace",
  principal: {
    userId: "user",
    clerkUserId: "clerk",
    clientId: "client",
    scopes: ["vcstudio:edit"],
  },
  connection: {
    id: "connection",
    userId: "user",
    clientId: "client",
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  grant: {
    publicationApprovalMode: "manual",
    connectionId: "connection",
    workspaceId: "workspace",
    scopes: ["vcstudio:edit"],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  membership: {
    workspaceId: "workspace",
    workspaceName: "Workspace",
    workspaceSlug: "workspace",
    role: "editor",
  },
};
function operation(status: McpOperation["status"] = "running"): McpOperation {
  return {
    id: "operation",
    workspaceId: "workspace",
    connectionId: "connection",
    userId: "user",
    kind: "save",
    idempotencyKey: "request-key",
    fingerprint: fingerprint({ kind: "save", input: { content: "draft" } }),
    status,
    input: {},
    result: null,
    error: null,
    sealedSource: "never-return-this",
    approvalHash: "never-return-this-either",
    triggerRunId: null,
    expiresAt: new Date(Date.now() + 60000),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.audit.mockResolvedValue(undefined);
});
describe("durable MCP mutations", () => {
  it("executes a new request once and persists the result", async () => {
    mocks.begin.mockResolvedValue({ created: true, operation: operation() });
    mocks.update.mockResolvedValue({
      ...operation("succeeded"),
      result: { revision: 2 },
    });
    const execute = vi.fn().mockResolvedValue({ revision: 2 });
    expect(
      (
        await mutateOnce(
          context,
          "save",
          "request-key",
          { content: "draft" },
          execute,
        )
      ).result,
    ).toEqual({ revision: 2 });
    expect(execute).toHaveBeenCalledOnce();
  });
  it("does not re-execute an existing request even when its previous outcome is unknown", async () => {
    const execute = vi.fn();
    for (const status of ["running", "failed", "succeeded"] as const) {
      mocks.begin.mockResolvedValue({
        created: false,
        operation: operation(status),
      });
      await mutateOnce(
        context,
        "save",
        "request-key",
        { content: "draft" },
        execute,
      );
    }
    expect(execute).not.toHaveBeenCalled();
  });
  it("rejects key reuse with changed inputs", async () => {
    mocks.begin.mockResolvedValue({ created: false, operation: operation() });
    await expect(
      mutateOnce(
        context,
        "save",
        "request-key",
        { content: "different" },
        vi.fn(),
      ),
    ).rejects.toThrow("different inputs");
  });
  it("does not expose sealed sources, proofs or raw inputs in public status", () => {
    expect(JSON.stringify(publicOperation(operation()))).not.toContain(
      "never-return",
    );
    expect(
      publicOperation({ ...operation(), expiresAt: new Date(0) }).status,
    ).toBe("expired");
  });
});
