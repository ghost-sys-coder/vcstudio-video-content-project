import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
vi.mock("server-only", () => ({}));
vi.mock("./context", () => ({
  authorizeMcp: vi.fn(async () => mcpContextFixture()),
}));
vi.mock("./rate-limit", () => ({ enforceMcpRateLimit: vi.fn() }));
vi.mock("./config", () => ({ mcpBaseUrl: () => "https://vcstudio.example" }));
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { createToolRegistrar, toolError } from "./register-tool";
import { McpError, McpScopeError } from "./errors";
import { mcpContextFixture, mcpIds } from "@/lib/test-utils/mcp-fixtures";

const clients: Client[] = [];
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("MCP tool validation", () => {
  it("returns the documented OAuth challenge only for a missing token scope", () => {
    const result = toolError(
      new McpScopeError("vcstudio:generate", ["vcstudio:read"]),
    );
    expect(result).toMatchObject({
      isError: true,
      structuredContent: { code: "insufficient_scope" },
      _meta: {
        "mcp/www_authenticate": [
          'Bearer resource_metadata="https://vcstudio.example/.well-known/oauth-protected-resource/mcp", scope="vcstudio:read vcstudio:generate", error="insufficient_scope", error_description="Reconnect VCStudio to authorize the required OAuth permission."',
        ],
      },
    });
    expect(
      toolError(new McpError("permission_denied", "Workspace grant denied."))
        ._meta,
    ).toBeUndefined();
    expect(toolError(new Error("private failure"))._meta).toBeUndefined();
  });
  it("passes the SDK's transformed output to the handler without parsing it again", async () => {
    const [a, b] = InMemoryTransport.createLinkedPair();
    const server = new McpServer({ name: "Validation test", version: "1" });
    const handler = vi.fn(
      async (
        _context: ReturnType<typeof mcpContextFixture>,
        input: { workspaceId: string; label: { value: string } },
      ) => input,
    );
    createToolRegistrar(server, mcpContextFixture().principal)(
      "normalized_input",
      "Exercise a schema whose output differs from its input.",
      "vcstudio:read",
      z.object({
        workspaceId: z.uuid(),
        label: z.string().transform((value) => ({ value })),
      }),
      true,
      handler,
    );
    await server.connect(b);
    const client = new Client({ name: "Validation client", version: "1" });
    clients.push(client);
    await client.connect(a);
    const result = await client.callTool({
      name: "normalized_input",
      arguments: { workspaceId: mcpIds.workspace, label: "Example" },
    });
    expect(result.isError).not.toBe(true);
    expect(handler).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ workspaceId: mcpIds.workspace }),
      { workspaceId: mcpIds.workspace, label: { value: "Example" } },
    );
  });

  it("identifies rejected fields without echoing submitted values", () => {
    const parsed = z
      .object({
        channelProfileId: z.uuid(),
        scenes: z.array(z.object({ duration: z.number().positive() })),
      })
      .safeParse({
        channelProfileId: "secret-value-that-must-not-be-echoed",
        scenes: [{ duration: -1 }],
      });
    if (parsed.success) throw new Error("Expected invalid fixture");
    const result = toolError(parsed.error);
    expect(result.structuredContent).toMatchObject({
      ok: false,
      code: "invalid_input",
      message: expect.stringContaining("channelProfileId"),
      issues: [
        { field: "channelProfileId", message: expect.any(String) },
        { field: "scenes.0.duration", message: expect.any(String) },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("secret-value");
  });

  it("bounds the count and length of issue details", () => {
    const result = toolError(
      new z.ZodError(
        Array.from({ length: 20 }, () => ({
          code: "custom",
          path: ["x".repeat(400)],
          message: "m".repeat(1000),
        })),
      ),
    );
    expect(result.structuredContent).toMatchObject({
      issues: Array.from({ length: 8 }, () => ({
        field: "x".repeat(200),
        message: "m".repeat(500),
      })),
    });
  });

  it("preserves actionable domain failures and hides internal errors", () => {
    expect(
      toolError(new McpError("conflict", "Read the current version.")),
    ).toMatchObject({
      structuredContent: {
        ok: false,
        code: "conflict",
        message: "Read the current version.",
      },
    });
    const internal = toolError(new Error("database-credential-secret"));
    expect(internal.structuredContent).toMatchObject({ code: "action_failed" });
    expect(JSON.stringify(internal)).not.toContain(
      "database-credential-secret",
    );
  });
});
