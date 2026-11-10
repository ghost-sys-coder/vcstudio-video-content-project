import type { McpScope } from "@studio/contracts";

export class McpError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "McpError";
  }
}
export class McpScopeError extends McpError {
  public readonly scopes: McpScope[];
  constructor(
    public readonly scope: McpScope,
    previousScopes: readonly McpScope[] = [],
  ) {
    super(
      "insufficient_scope",
      `Your client authorization is missing the ${scope} permission. Reconnect VCStudio to authorize it.`,
    );
    this.name = "McpScopeError";
    this.scopes = [...new Set([...previousScopes, scope])];
  }
}
export function requireMcp(
  value: unknown,
  code: string,
  message: string,
): asserts value {
  if (!value) throw new McpError(code, message);
}
