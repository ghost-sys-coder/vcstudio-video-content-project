import { ElevenLabsPresetError } from "@/lib/elevenlabs/errors";
import { ElevenLabsUnavailableError } from "@/lib/elevenlabs/configuration";
import { ElevenLabsApiError } from "@/lib/elevenlabs/client";
import { z } from "zod";
import type {
  McpServer,
  CallToolResult,
  StandardSchemaWithJSON,
} from "@modelcontextprotocol/server";
import type { McpPrincipal, McpScope } from "@studio/contracts";
import { authorizeMcp, type McpContext } from "./context";
import { McpError, McpScopeError } from "./errors";
import { enforceMcpRateLimit } from "./rate-limit";
import { mcpAuthChallenge, mcpToolAuthMetadata } from "./auth-metadata";
import { mcpBaseUrl } from "./config";
export type McpToolRegistrar = ReturnType<typeof createToolRegistrar>;
export function toolResult(data: unknown): CallToolResult {
  const structured = {
    ok: true,
    data: JSON.parse(JSON.stringify(data ?? null)),
  };
  return {
    content: [{ type: "text", text: JSON.stringify(structured) }],
    structuredContent: structured,
  };
}
export function toolError(error: unknown): CallToolResult {
  if (error instanceof ElevenLabsPresetError)
    return toolError(new McpError("invalid_input", error.message));
  if (
    error instanceof ElevenLabsUnavailableError ||
    error instanceof ElevenLabsApiError
  )
    return toolError(new McpError("provider_unavailable", error.message));
  const issues =
    error instanceof z.ZodError
      ? error.issues.slice(0, 8).map((issue) => ({
          field: issue.path.map(String).join(".").slice(0, 200) || "input",
          message: issue.message.slice(0, 500),
        }))
      : undefined;
  const code =
    error instanceof McpError
      ? error.code
      : error instanceof z.ZodError
        ? "invalid_input"
        : "action_failed";
  const message =
    error instanceof McpError
      ? error.message
      : issues
        ? issues[0]
          ? `${issues[0].field}: ${issues[0].message}`
          : "Invalid tool input."
        : "The action could not be completed. Refresh the current content before retrying.";
  const result = { ok: false, code, message, ...(issues ? { issues } : {}) };
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(result) }],
    structuredContent: result,
    ...(error instanceof McpScopeError
      ? {
          _meta: {
            "mcp/www_authenticate": [
              mcpAuthChallenge({
                baseUrl: mcpBaseUrl(),
                scopes: error.scopes,
                insufficientScope: true,
              }),
            ],
          },
        }
      : {}),
  };
}
export function createToolRegistrar(
  server: McpServer,
  principal: McpPrincipal,
) {
  return function register<S extends z.ZodObject>(
    name: string,
    description: string,
    scope: McpScope,
    schema: S,
    readOnly: boolean,
    handler: (context: McpContext, input: z.infer<S>) => Promise<unknown>,
  ) {
    const wireSchema: StandardSchemaWithJSON<z.input<S>, z.output<S>> = schema;
    server.registerTool(
      name,
      {
        description,
        inputSchema: wireSchema,
        _meta: {
          ...mcpToolAuthMetadata([scope]),
          ...(name === "import_chat_file"
            ? { "openai/fileParams": ["file"] }
            : {}),
        },
        annotations: {
          readOnlyHint: readOnly,
          destructiveHint:
            !readOnly &&
            ![
              "start_media_upload",
              "append_media_upload",
              "complete_media_upload",
            ].includes(name),
          openWorldHint:
            scope === "vcstudio:publish" || name === "import_asset",
        },
      },
      async (parsed) => {
        try {
          // The SDK already validated and transformed this schema's input.
          // Parsing its output again can reject normalized optional values.
          const workspaceId = z
            .object({ workspaceId: z.uuid() })
            .parse(parsed).workspaceId;
          const context = await authorizeMcp(principal, workspaceId, scope);
          await enforceMcpRateLimit(
            context,
            name === "append_media_upload"
              ? "upload_chunk"
              : readOnly
                ? "read"
                : "write",
          );
          return toolResult(await handler(context, parsed));
        } catch (error) {
          return toolError(error);
        }
      },
    );
  };
}
