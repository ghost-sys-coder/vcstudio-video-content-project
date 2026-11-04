import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  beginMcpOperation,
  updateMcpOperation,
} from "@/db/repositories/mcp.repository";
import type { McpOperation } from "@/db/repositories/mcp.repository";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  create: vi.fn(),
  begin: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("./context", () => ({ authorizeMcp: mocks.authorize }));
vi.mock("./rate-limit", () => ({ enforceMcpRateLimit: vi.fn() }));
vi.mock("@/db/commands/create-project.command", () => ({
  createProject: mocks.create,
}));
vi.mock("@/db/repositories/mcp.repository", () => ({
  beginMcpOperation: mocks.begin,
  updateMcpOperation: mocks.update,
}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: mocks.audit,
}));
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { createToolRegistrar } from "./register-tool";
import { registerContentTools } from "./register-content-tools";
import { McpError } from "./errors";
import {
  mcpContextFixture,
  mcpIds,
  mcpOperationFixture,
} from "@/lib/test-utils/mcp-fixtures";

const context = mcpContextFixture();
const operations = new Map<string, McpOperation>();
const clients: Client[] = [];
const projectId = "88888888-8888-4888-8888-888888888888";
const request = {
  workspaceId: mcpIds.workspace,
  idempotencyKey: "mcp-reuse-project-1234",
  name: "MCP reuse test",
  aspectRatio: "16:9",
  framesPerSecond: 30,
  language: "English",
  maximumBudgetCents: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  operations.clear();
  mocks.authorize.mockResolvedValue(context);
  mocks.create.mockResolvedValue({ id: projectId });
  mocks.begin.mockImplementation(
    async (input: Parameters<typeof beginMcpOperation>[0]) => {
      const existing = operations.get(input.idempotencyKey);
      if (existing) return { created: false, operation: existing };
      const operation = mcpOperationFixture({ ...input });
      operations.set(input.idempotencyKey, operation);
      return { created: true, operation };
    },
  );
  mocks.update.mockImplementation(
    async (input: Parameters<typeof updateMcpOperation>[0]) => {
      const operation = [...operations.values()].find(
        (op) => op.id === input.operationId,
      );
      if (!operation) throw new Error("Missing test operation");
      const updated = { ...operation, ...input.values };
      operations.set(updated.idempotencyKey, updated);
      return updated;
    },
  );
  mocks.audit.mockResolvedValue(undefined);
});
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});
async function connect() {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = new McpServer({ name: "Project regression", version: "1" });
  registerContentTools(createToolRegistrar(server, context.principal));
  await server.connect(serverTransport);
  const client = new Client({ name: "MCP test client", version: "1" });
  clients.push(client);
  await client.connect(clientTransport);
  return client;
}

describe("MCP project creation through the SDK and application service", () => {
  it.each([0, 200])(
    "creates a project with a %i-cent budget and omitted reference selectors",
    async (budget) => {
      const client = await connect();
      const result = await client.callTool({
        name: "create_project",
        arguments: { ...request, maximumBudgetCents: budget },
      });
      expect(result.isError, JSON.stringify(result)).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        ok: true,
        data: {
          status: "succeeded",
          result: { projectId, href: `/app/projects/${projectId}` },
        },
      });
      expect(mocks.create).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          workspaceId: mcpIds.workspace,
          userId: mcpIds.user,
          maximumBudgetCents: budget,
          videoKind: "staticImages",
          description: "",
          channelProfileId: null,
        }),
      );
    },
  );
  it("normalizes empty selectors and coerced numbers once", async () => {
    const result = await (
      await connect()
    ).callTool({
      name: "create_project",
      arguments: {
        ...request,
        framesPerSecond: "30",
        maximumBudgetCents: "0",
        channelProfileId: "",
        formatPresetId: "",
        stylePresetId: "",
      },
    });
    expect(result.isError, JSON.stringify(result)).not.toBe(true);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ framesPerSecond: 30, maximumBudgetCents: 0 }),
    );
  });
  it("returns the saved project on retry and rejects changed inputs", async () => {
    const client = await connect();
    const first = await client.callTool({
      name: "create_project",
      arguments: request,
    });
    expect(first.isError, JSON.stringify(first)).not.toBe(true);
    const repeated = await client.callTool({
      name: "create_project",
      arguments: request,
    });
    expect(repeated.structuredContent).toEqual(first.structuredContent);
    const changed = await client.callTool({
      name: "create_project",
      arguments: { ...request, name: "Different project" },
    });
    expect(changed.structuredContent).toMatchObject({
      ok: false,
      code: "conflict",
    });
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it.each([
    ["maximumBudgetCents", -1],
    ["framesPerSecond", 121],
    ["language", ""],
  ])(
    "identifies invalid %s before authorization or mutation",
    async (field, value) => {
      const result = await (
        await connect()
      ).callTool({
        name: "create_project",
        arguments: { ...request, [field]: value },
      });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result.content)).toContain(field);
      expect(mocks.authorize).not.toHaveBeenCalled();
      expect(mocks.begin).not.toHaveBeenCalled();
      expect(mocks.create).not.toHaveBeenCalled();
    },
  );
  it("still refuses unsupported reference-bearing creation", async () => {
    const result = await (
      await connect()
    ).callTool({
      name: "create_project",
      arguments: { ...request, channelProfileId: mcpIds.destination },
    });
    expect(result.structuredContent).toMatchObject({
      ok: false,
      code: "invalid_input",
      message: expect.stringContaining("basic project"),
    });
    expect(mocks.begin).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("does not create a project without the workspace edit grant", async () => {
    mocks.authorize.mockRejectedValue(
      new McpError("permission_denied", "Edit grant required."),
    );
    const result = await (
      await connect()
    ).callTool({
      name: "create_project",
      arguments: request,
    });
    expect(result.structuredContent).toMatchObject({
      ok: false,
      code: "permission_denied",
    });
    expect(mocks.begin).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
