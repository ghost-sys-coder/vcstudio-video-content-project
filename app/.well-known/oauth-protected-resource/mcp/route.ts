import { MCP_SCOPES } from "@studio/contracts";
import { mcpBaseUrl, clerkOAuthIssuer } from "@/lib/mcp/config";
export async function GET() {
  return Response.json(
    {
      resource: `${mcpBaseUrl()}/mcp`,
      authorization_servers: [clerkOAuthIssuer()],
      scopes_supported: MCP_SCOPES,
      bearer_methods_supported: ["header"],
      resource_documentation: `${mcpBaseUrl()}/app/settings/mcp`,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
