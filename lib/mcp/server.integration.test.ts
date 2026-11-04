import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  authorize: vi.fn(),
  connection: vi.fn(),
  grants: vi.fn(),
  memberships: vi.fn(),
  prepare: vi.fn(),
  confirm: vi.fn(),
  previewOrigin: vi.fn(),
  mediaPreviews: vi.fn(),
}));
vi.mock("@/lib/mcp/context", () => ({ authorizeMcp: m.authorize }));
vi.mock("@/lib/mcp/rate-limit", () => ({ enforceMcpRateLimit: vi.fn() }));
vi.mock("@/db/repositories/mcp.repository", () => ({
  ensureMcpConnection: m.connection,
  listMcpGrants: m.grants,
}));
vi.mock("@/db/repositories/workspaces.repository", () => ({
  listWorkspaceMemberships: m.memberships,
}));
vi.mock("@/lib/mcp/publishing-service", () => ({
  prepareMcpPublication: m.prepare,
  approveMcpPublication: m.confirm,
}));
vi.mock("@/lib/mcp/media-previews", () => ({
  loadMcpMediaPreviews: m.mediaPreviews,
  getMcpMediaPreviewOrigin: m.previewOrigin,
}));
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("<!doctype html><title>Review</title>"),
}));
vi.mock("@/lib/mcp/import-service", () => ({ startMcpImport: vi.fn() }));
import { Client } from "@modelcontextprotocol/client";
import {
  createMcpHandler,
  InMemoryTransport,
} from "@modelcontextprotocol/server";
import { createVcStudioMcpServer } from "./server";
import {
  mcpContextFixture,
  mcpIds,
  mcpOperationFixture,
} from "@/lib/test-utils/mcp-fixtures";
import { publicOperation } from "./operations";
const ctx = mcpContextFixture();
const clients: Client[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  m.authorize.mockResolvedValue(ctx);
  m.connection.mockResolvedValue(ctx.connection);
  m.grants.mockResolvedValue([ctx.grant]);
  m.memberships.mockResolvedValue([ctx.membership]);
  m.previewOrigin.mockResolvedValue(
    "https://studio.account.r2.cloudflarestorage.com",
  );
  m.mediaPreviews.mockResolvedValue([]);
  m.prepare.mockResolvedValue({
    operation: publicOperation(mcpOperationFixture()),
    preview: {
      postId: mcpIds.post,
      version: 1,
      text: "Human-approved copy",
      media: [],
      destinations: [
        {
          id: mcpIds.destination,
          platform: "linkedin",
          name: "My profile",
          text: "Human-approved copy",
        },
      ],
      scheduledAt: null,
      timezone: "UTC",
    },
    uiProof: "private-ui-proof-not-for-the-model-123456",
  });
});
afterEach(async () => {
  await Promise.all(clients.splice(0).map((c) => c.close()));
});
async function client() {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = createVcStudioMcpServer(ctx.principal);
  await server.connect(b);
  const instance = new Client({ name: "VCStudio test host", version: "1.0.0" });
  clients.push(instance);
  await instance.connect(a);
  return instance;
}
describe("real MCP SDK interoperability", () => {
  it("allows the actual signed media origin in the review resource's narrow CSP", async () => {
    const result = await (
      await client()
    ).readResource({
      uri: "ui://vcstudio/publication-review.html",
    });
    expect(result.contents[0]._meta).toMatchObject({
      ui: {
        csp: {
          connectDomains: [],
          resourceDomains: ["https://studio.account.r2.cloudflarestorage.com"],
        },
      },
    });
  });
  it("negotiates the protocol and exposes focused v1 tools, native file metadata and app-only approval", async () => {
    const tools = (await (await client()).listTools()).tools;
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        "get_connection",
        "save_script_draft",
        "import_chat_file",
        "assign_scene_image",
        "save_post",
        "prepare_publication",
        "confirm_publication",
      ]),
    );
    expect(
      tools.find((t) => t.name === "import_chat_file")?._meta?.[
        "openai/fileParams"
      ],
    ).toEqual(["file"]);
    expect(
      tools.find((t) => t.name === "confirm_publication")?._meta?.ui,
    ).toEqual(expect.objectContaining({ visibility: ["app"] }));
    expect(
      tools.some((t) =>
        /marketing|generate|delete_project|sql|shell/.test(t.name),
      ),
    ).toBe(false);
    const file = tools.find((t) => t.name === "import_chat_file");
    expect(JSON.stringify(file?.inputSchema)).toContain("download_url");
  });
  it("keeps the approval proof outside content and structured model data", async () => {
    m.mediaPreviews.mockResolvedValue([
      {
        id: mcpIds.asset,
        kind: "image",
        url: "https://studio.account.r2.cloudflarestorage.com/preview.png?X-Amz-Signature=private-media-signature",
      },
    ]);
    const result = await (
      await client()
    ).callTool({
      name: "prepare_publication",
      arguments: {
        workspaceId: mcpIds.workspace,
        idempotencyKey: "prepare-1234",
        postId: mcpIds.post,
        expectedVersion: 1,
        connectionIds: [mcpIds.destination],
      },
    });
    expect(result.isError).not.toBe(true);
    expect(result._meta?.approvalProof).toBe(
      "private-ui-proof-not-for-the-model-123456",
    );
    expect(
      JSON.stringify([result.content, result.structuredContent]),
    ).not.toContain("private-ui-proof");
    expect(result._meta?.mediaPreviews).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: mcpIds.asset })]),
    );
    expect(
      JSON.stringify([result.content, result.structuredContent]),
    ).not.toContain("private-media-signature");
    expect(m.confirm).not.toHaveBeenCalled();
  });
  it("does not treat a model's confirmed boolean as approval", async () => {
    const result = await (
      await client()
    ).callTool({
      name: "confirm_publication",
      arguments: {
        workspaceId: mcpIds.workspace,
        operationId: mcpIds.operation,
        confirmed: true,
      },
    });
    expect(result.isError).toBe(true);
    expect(m.confirm).not.toHaveBeenCalled();
  });
  it("serves legacy Streamable HTTP requests statelessly through the actual SDK handler", async () => {
    const handler = createMcpHandler(
      () => createVcStudioMcpServer(ctx.principal),
      { legacy: "stateless", responseMode: "json" },
    );
    const response = await handler.fetch(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            clientInfo: { name: "test", version: "1" },
          },
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("VCStudio");
    await handler.close();
  });
});
