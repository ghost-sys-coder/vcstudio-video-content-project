export class McpError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "McpError";
  }
}
export function requireMcp(
  value: unknown,
  code: string,
  message: string,
): asserts value {
  if (!value) throw new McpError(code, message);
}
