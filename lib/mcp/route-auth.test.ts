import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ authenticate: vi.fn(), enabled: true }));
vi.mock("./context", () => ({ authenticateMcp: m.authenticate }));
vi.mock("./server", () => ({ createVcStudioMcpServer: vi.fn() }));
vi.mock("./config", () => ({ mcpBaseUrl: () => "https://vcstudio.example" }));
vi.mock("@/lib/env/server", () => ({
  getMcpEnvironment: () => ({ ENABLE_MCP: m.enabled }),
}));
import { POST } from "@/app/mcp/route";
import { MCP_SCOPES } from "@studio/contracts";
import { McpError } from "./errors";
beforeEach(() => {
  vi.clearAllMocks();
  m.enabled = true;
});
const request = () =>
  new Request("https://vcstudio.example/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }),
  });
describe("MCP HTTP authorization challenges", () => {
  it("advertises the six current scopes in the initial unauthenticated challenge", async () => {
    m.authenticate.mockRejectedValue(
      new McpError("unauthenticated", "Connect your own account."),
    );
    const response = await POST(request());
    expect(response.status).toBe(401);
    const challenge = response.headers.get("WWW-Authenticate");
    expect(challenge).toContain(
      'resource_metadata="https://vcstudio.example/.well-known/oauth-protected-resource/mcp"',
    );
    expect(challenge).toContain(`scope="${MCP_SCOPES.join(" ")}"`);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it("does not offer OAuth as a way around private access or internal failures", async () => {
    for (const [error, status] of [
      [new McpError("permission_denied", "Private access only."), 403],
      [new Error("private-database-error"), 503],
    ] as const) {
      m.authenticate.mockRejectedValue(error);
      const response = await POST(request());
      expect(response.status).toBe(status);
      expect(response.headers.has("WWW-Authenticate")).toBe(false);
      expect(await response.text()).not.toContain("private-database-error");
    }
  });
});
