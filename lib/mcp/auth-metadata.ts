import type { McpScope } from "@studio/contracts";

/** Explicit per-tool OAuth requirements, including MCP Apps-only tools. */
export function mcpToolAuthMetadata(scopes: readonly McpScope[]) {
  return { securitySchemes: [{ type: "oauth2", scopes: [...scopes] }] };
}

export function mcpAuthChallenge(input: {
  baseUrl: string;
  scopes: readonly McpScope[];
  insufficientScope?: boolean;
}) {
  const metadata = new URL(
    "/.well-known/oauth-protected-resource/mcp",
    input.baseUrl,
  ).href;
  return [
    `Bearer resource_metadata=${JSON.stringify(metadata)}`,
    ...(input.scopes.length
      ? [`scope=${JSON.stringify(input.scopes.join(" "))}`]
      : []),
    ...(input.insufficientScope
      ? [
          'error="insufficient_scope"',
          'error_description="Reconnect VCStudio to authorize the required OAuth permission."',
        ]
      : []),
  ].join(", ");
}
