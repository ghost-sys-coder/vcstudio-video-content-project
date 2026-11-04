import { createMcpHandler } from "@modelcontextprotocol/server";
import { authenticateMcp } from "@/lib/mcp/context";
import { createVcStudioMcpServer } from "@/lib/mcp/server";
import { getMcpEnvironment } from "@/lib/env/server";
import { mcpBaseUrl } from "@/lib/mcp/config";
import { McpError } from "@/lib/mcp/errors";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  if (
    !origin ||
    ![mcpBaseUrl(), "https://chatgpt.com", "https://claude.ai"].includes(origin)
  )
    return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id",
      Vary: "Origin",
    },
  });
}
export async function POST(request: Request) {
  if (!getMcpEnvironment().ENABLE_MCP)
    return Response.json({ error: "MCP is disabled." }, { status: 503 });
  const origin = request.headers.get("origin");
  if (
    origin &&
    ![mcpBaseUrl(), "https://chatgpt.com", "https://claude.ai"].includes(origin)
  )
    return new Response("Origin is not allowed.", { status: 403 });
  try {
    const principal = await authenticateMcp();
    const handler = createMcpHandler(() => createVcStudioMcpServer(principal), {
      legacy: "stateless",
      responseMode: "json",
      keepAliveMs: 0,
      maxSubscriptions: 0,
      maxRequestBodySize: 1024 * 1024,
    });
    const response = await handler.fetch(request);
    response.headers.set("Cache-Control", "no-store");
    if (origin) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set(
        "Access-Control-Expose-Headers",
        "WWW-Authenticate, MCP-Protocol-Version",
      );
      response.headers.set("Vary", "Origin");
    }
    return response;
  } catch (error) {
    const unauthenticated =
      error instanceof McpError && error.code === "unauthenticated";
    return Response.json(
      {
        error: unauthenticated
          ? error.message
          : "MCP is unavailable. Check connection setup.",
      },
      {
        status: unauthenticated ? 401 : 503,
        headers: {
          ...(origin
            ? {
                "Access-Control-Allow-Origin": origin,
                "Access-Control-Expose-Headers": "WWW-Authenticate",
                Vary: "Origin",
              }
            : {}),
          "Cache-Control": "no-store",
          "WWW-Authenticate": `Bearer resource_metadata="${mcpBaseUrl()}/.well-known/oauth-protected-resource/mcp"`,
        },
      },
    );
  }
}
