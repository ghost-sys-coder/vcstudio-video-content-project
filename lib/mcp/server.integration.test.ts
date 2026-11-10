import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  authorize: vi.fn(),
  connection: vi.fn(),
  grants: vi.fn(),
  memberships: vi.fn(),
  prepare: vi.fn(),
  confirm: vi.fn(),
  execute: vi.fn(),
  previewOrigin: vi.fn(),
  mediaPreviews: vi.fn(),
  generationPrepare: vi.fn(),
  generationExecute: vi.fn(),
  generationConfirm: vi.fn(),
  generationStatus: vi.fn(),
}));
vi.mock("@/lib/mcp/context", () => ({ authorizeMcp: m.authorize }));
vi.mock("@/lib/mcp/rate-limit", () => ({ enforceMcpRateLimit: vi.fn() }));
vi.mock("@/lib/env/server", () => ({
  getMcpEnvironment: () => ({
    ENABLE_MCP: true,
    APP_BASE_URL: "https://vcstudio.example",
  }),
  getPublishingEnvironment: () => ({ ENABLE_SOCIAL_POSTING: true }),
  getSceneImageEnvironment: () => ({ ENABLE_SCENE_IMAGE_GENERATION: true }),
  getSceneAudioEnvironment: () => ({ ENABLE_SCENE_AUDIO_GENERATION: true }),
  getMediaLibraryEnvironment: () => ({
    MAX_MEDIA_IMAGE_BYTES: 25 * 1024 * 1024,
    MAX_MEDIA_VIDEO_BYTES: 512 * 1024 * 1024,
  }),
}));
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
  executeMcpPublication: m.execute,
}));
vi.mock("@/lib/mcp/media-previews", () => ({
  loadMcpMediaPreviews: m.mediaPreviews,
  getMcpMediaPreviewOrigin: m.previewOrigin,
}));
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn().mockResolvedValue("<!doctype html><title>Review</title>"),
}));
vi.mock("@/lib/mcp/import-service", () => ({ startMcpImport: vi.fn() }));
vi.mock("@/lib/mcp/generation-service", () => ({
  prepareMcpGeneration: m.generationPrepare,
  executeMcpGeneration: m.generationExecute,
  approveMcpGeneration: m.generationConfirm,
  getMcpGenerationStatus: m.generationStatus,
}));
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
import { MCP_SERVER_VERSION } from "@studio/contracts/mcp-upload";
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
  it("advertises focused generation tools with UI-only confirmation and private proof metadata", async () => {
    const api = await client();
    const tools = await api.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        "get_generation_options",
        "prepare_generation",
        "execute_generation",
        "get_generation_status",
        "review_scene_audio",
      ]),
    );
    expect(
      tools.tools.find((tool) => tool.name === "confirm_generation")?._meta,
    ).toMatchObject({ ui: { visibility: ["app"] } });
    m.generationPrepare.mockResolvedValue({
      operation: publicOperation(
        mcpOperationFixture({ kind: "generate_media" }),
      ),
      preview: { kind: "image", estimatedCostCents: 5 },
      approvalMode: "manual",
      uiProof: "private-generation-proof-1234567890123456",
    });
    const result = await api.callTool({
      name: "prepare_generation",
      arguments: {
        workspaceId: mcpIds.workspace,
        idempotencyKey: "prepare-generation-123",
        request: {
          kind: "image",
          prompt: "A useful image",
          size: "1024x1024",
          quality: "low",
          maximumCostCents: 20,
        },
      },
    });
    expect(result.structuredContent).toMatchObject({
      ok: true,
      data: { approvalMode: "manual" },
    });
    expect(result._meta?.approvalProof).toBe(
      "private-generation-proof-1234567890123456",
    );
    expect(
      JSON.stringify([result.structuredContent, result.content]),
    ).not.toContain("private-generation-proof");
    expect(m.authorize).toHaveBeenCalledWith(
      ctx.principal,
      mcpIds.workspace,
      "vcstudio:generate",
    );
    const resource = await api.readResource({
      uri: "ui://vcstudio/generation-review.html",
    });
    expect(resource.contents[0]._meta).toMatchObject({
      ui: { csp: { connectDomains: [], resourceDomains: [] } },
    });
    const confirmation = await api.callTool({
      name: "confirm_generation",
      arguments: {
        workspaceId: mcpIds.workspace,
        operationId: mcpIds.operation,
        confirmed: true,
      },
    });
    expect(confirmation.isError).toBe(true);
    expect(m.generationConfirm).not.toHaveBeenCalled();
  });
  it("advertises the new transfer/version tools and serves an upload app with no network origins", async () => {
    const connection = await client(),
      tools = await connection.listTools();
    expect(tools.tools.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        "open_media_upload",
        "start_media_upload",
        "append_media_upload",
        "complete_media_upload",
        "get_media_upload",
        "cancel_media_upload",
        "execute_publication",
      ]),
    );
    for (const name of [
      "start_media_upload",
      "append_media_upload",
      "complete_media_upload",
    ])
      expect(
        tools.tools.find((tool) => tool.name === name)?.annotations,
      ).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    expect(
      tools.tools.find((tool) => tool.name === "cancel_media_upload")
        ?.annotations?.destructiveHint,
    ).toBe(true);
    const opened = await connection.callTool({
      name: "open_media_upload",
      arguments: { workspaceId: mcpIds.workspace },
    });
    expect(opened.structuredContent).toMatchObject({
      ok: true,
      data: {
        workspaceId: mcpIds.workspace,
        serverVersion: MCP_SERVER_VERSION,
        limits: { chunkBytes: 512 * 1024 },
      },
    });
    expect(m.authorize).toHaveBeenCalledWith(
      ctx.principal,
      mcpIds.workspace,
      "vcstudio:media",
    );
    const resource = await connection.readResource({
      uri: "ui://vcstudio/media-upload.html",
    });
    expect(resource.contents[0]._meta).toMatchObject({
      ui: { csp: { connectDomains: [], resourceDomains: [] } },
    });
  });
  it("advertises the effective approval mode without enabling autonomy", async () => {
    const result = await (
      await client()
    ).callTool({
      name: "get_capabilities",
      arguments: { workspaceId: mcpIds.workspace },
    });
    expect(result.structuredContent).toMatchObject({
      ok: true,
      data: { publicationApprovalMode: "manual" },
    });
  });
  it("exposes explicit agent execution with its preparation idempotency key", async () => {
    m.execute.mockResolvedValue(
      publicOperation(mcpOperationFixture({ status: "succeeded" })),
    );
    const connection = await client();
    const args = {
      workspaceId: mcpIds.workspace,
      operationId: mcpIds.operation,
      idempotencyKey: "execute-key-123",
    };
    const result = await connection.callTool({
      name: "execute_publication",
      arguments: args,
    });
    expect(result.structuredContent).toMatchObject({
      ok: true,
      data: { status: "succeeded" },
    });
    expect(m.authorize).toHaveBeenCalledWith(
      ctx.principal,
      mcpIds.workspace,
      "vcstudio:publish",
    );
    expect(m.execute).toHaveBeenCalledWith(
      ctx,
      mcpIds.operation,
      args.idempotencyKey,
    );
    m.execute.mockClear();
    expect(
      (
        await connection.callTool({
          name: "execute_publication",
          arguments: {
            workspaceId: mcpIds.workspace,
            operationId: mcpIds.operation,
            confirmed: true,
          },
        })
      ).isError,
    ).toBe(true);
    expect(m.execute).not.toHaveBeenCalled();
  });
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
