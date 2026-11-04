import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  authorize: vi.fn(),
  save: vi.fn(),
  post: vi.fn(),
  ids: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock("./context", () => ({ authorizeMcp: m.authorize }));
vi.mock("./rate-limit", () => ({ enforceMcpRateLimit: vi.fn() }));
vi.mock("./operations", () => ({ mutateOnce: m.mutate }));
vi.mock("@/lib/social/save-social-draft", () => ({
  saveAuthorizedSocialDraft: m.save,
}));
vi.mock("@/db/repositories/social-post-destinations.repository", () => ({
  listSocialPostDraftConnectionIds: m.ids,
}));
vi.mock("@/db/repositories/social-posts.repository", () => ({
  findSocialPost: m.post,
  listSocialPostMedia: vi.fn().mockResolvedValue([]),
  listSocialPostTargets: vi.fn().mockResolvedValue([]),
}));
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { createToolRegistrar } from "./register-tool";
import { registerSocialTools } from "./register-social-tools";
import { McpError } from "./errors";
import { mcpContextFixture, mcpIds } from "@/lib/test-utils/mcp-fixtures";
const ctx = mcpContextFixture();
const clients: Client[] = [];
beforeEach(() => {
  vi.clearAllMocks();
  m.authorize.mockResolvedValue(ctx);
  m.save.mockResolvedValue({
    outcome: "updated",
    post: { id: mcpIds.post, version: 3, bodyPlainText: "Saved copy" },
  });
  m.mutate.mockImplementation(
    async (
      _ctx: unknown,
      _kind: string,
      _key: string,
      _input: unknown,
      run: () => Promise<unknown>,
    ) => ({ result: await run() }),
  );
  m.ids.mockResolvedValue([mcpIds.destination]);
  m.post.mockResolvedValue({
    id: mcpIds.post,
    name: "Draft",
    bodyPlainText: "Saved copy",
    version: 3,
    status: "draft",
    scheduledAt: null,
    scheduledTimezone: "UTC",
  });
});
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});
async function client() {
  const server = new McpServer({
    name: "social-draft-regression",
    version: "1",
  });
  registerSocialTools(createToolRegistrar(server, ctx.principal));
  const [front, back] = InMemoryTransport.createLinkedPair();
  const c = new Client({ name: "test", version: "1" });
  await server.connect(back);
  await c.connect(front);
  clients.push(c);
  return c;
}
const request = {
  workspaceId: mcpIds.workspace,
  postId: mcpIds.post,
  expectedVersion: 2,
  idempotencyKey: "save-chosen-accounts",
  name: "Draft",
  text: "Saved copy",
  mediaAssetIds: [],
};
describe("MCP Social draft destination contract", () => {
  it.each([{ connectionIds: [mcpIds.destination] }, { connectionIds: [] }])(
    "passes explicit account selection %j through SDK validation to the shared save",
    async ({ connectionIds }) => {
      const c = await client();
      const result = await c.callTool({
        name: "save_post",
        arguments: { ...request, connectionIds },
      });
      expect(result.isError).not.toBe(true);
      expect(m.save).toHaveBeenCalledWith(
        { workspaceId: ctx.workspaceId, role: ctx.membership.role },
        expect.objectContaining({ connectionIds }),
      );
    },
  );
  it("preserves omission for older callers and rejects duplicate IDs", async () => {
    const c = await client();
    await c.callTool({ name: "save_post", arguments: request });
    expect(m.save.mock.calls[0]?.[1].connectionIds).toBeUndefined();
    m.save.mockClear();
    const duplicate = await c.callTool({
      name: "save_post",
      arguments: {
        ...request,
        connectionIds: [mcpIds.destination, mcpIds.destination],
      },
    });
    expect(duplicate.isError).toBe(true);
    expect(m.save).not.toHaveBeenCalled();
  });
  it("reads saved draft destinations without inventing publication targets", async () => {
    const c = await client();
    const result = await c.callTool({
      name: "get_post",
      arguments: { workspaceId: mcpIds.workspace, postId: mcpIds.post },
    });
    expect(result.structuredContent).toMatchObject({
      ok: true,
      data: {
        connectionIds: [mcpIds.destination],
        targets: [],
        status: "draft",
      },
    });
    expect(m.ids).toHaveBeenCalledWith({
      workspaceId: ctx.workspaceId,
      postId: mcpIds.post,
    });
  });
  it("denies a missing edit grant before saving any destination", async () => {
    m.authorize.mockRejectedValue(
      new McpError("permission_denied", "Permission denied"),
    );
    const c = await client();
    const result = await c.callTool({
      name: "save_post",
      arguments: { ...request, connectionIds: [mcpIds.destination] },
    });
    expect(result.isError).toBe(true);
    expect(m.save).not.toHaveBeenCalled();
  });
});
