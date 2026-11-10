import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import type { McpPrincipal } from "@studio/contracts";
import {
  MCP_UPLOAD_RESOURCE,
  MCP_SERVER_VERSION,
  mcpUploadStartInput,
  mcpUploadChunkInput,
  mcpUploadMutation,
  mcpUploadRef,
} from "@studio/contracts/mcp-upload";
import { authorizeMcp } from "./context";
import { enforceMcpRateLimit } from "./rate-limit";
import { toolResult, toolError, type McpToolRegistrar } from "./register-tool";
import { mcpToolAuthMetadata } from "./auth-metadata";
import {
  startMcpChunkUpload,
  appendMcpUpload,
  completeMcpUpload,
  cancelMcpUpload,
  mcpUploadSession,
  findOwnedMcpUpload,
  mcpUploadLimits,
} from "./chunk-upload-service";

export function registerUploadTools(
  server: McpServer,
  register: McpToolRegistrar,
  principal: McpPrincipal,
) {
  register(
    "start_media_upload",
    "Start a resumable browser-free MCP image/video upload. Supply the real file's byte size and fingerprint from fixed-size SHA-256 chunk digests. No local path is remotely readable. Prefer import_chat_file when a native file reference exists, or open_media_upload for an in-chat file picker. Never transcribe video bytes from model reasoning.",
    "vcstudio:media",
    mcpUploadStartInput,
    false,
    async (ctx, p) => {
      await enforceMcpRateLimit(ctx, "import");
      return startMcpChunkUpload(ctx, p);
    },
  );
  register(
    "append_media_upload",
    "Send one original binary chunk as canonical base64, with its SHA-256 digest. Use only programmatically read file bytes or the in-chat upload app. The idempotency key is mcp-upload:{uploadId}:{index}:{sha256}. Matching retries reuse a chunk; different bytes conflict. Chunk bytes never appear in results.",
    "vcstudio:media",
    mcpUploadChunkInput,
    false,
    appendMcpUpload,
  );
  register(
    "complete_media_upload",
    "Complete an existing MCP upload using idempotencyKey mcp-upload:{uploadId}:complete. Requires every chunk. Queues existing import/inspection; does not approve, publish or schedule. Retrying the same completion never uploads again. Read get_media_upload/get_operation until ready before attaching or publishing.",
    "vcstudio:media",
    mcpUploadMutation,
    false,
    completeMcpUpload,
  );
  register(
    "get_media_upload",
    "Read this connection's upload progress, received chunk indices and inspection state. Resume missing chunks using the same original file and upload ID. No background polling.",
    "vcstudio:media",
    mcpUploadRef,
    true,
    async (ctx, p) =>
      mcpUploadSession(ctx, await findOwnedMcpUpload(ctx, p.uploadId)),
  );
  register(
    "cancel_media_upload",
    "Cancel an unprocessed temporary upload using idempotencyKey mcp-upload:{uploadId}:cancel. Removes only that upload's staging chunks. Cannot delete a library asset, project or published post.",
    "vcstudio:media",
    mcpUploadMutation,
    false,
    cancelMcpUpload,
  );
  registerAppTool(
    server,
    "open_media_upload",
    {
      description:
        "Open the secure in-chat image/video picker for Claude or ChatGPT. It transfers bytes using MCP tools only, with no Chrome tab, R2 network access or browser upload handoff. The user selects the original file in this panel; it never publishes. Use this when chat files are not exposed as downloadable references. If the client lacks MCP Apps, use programmatic start/append/complete upload tools or explain the limitation; do not substitute browser automation.",
      inputSchema: z.object({
        workspaceId: z.uuid(),
        uploadId: z.uuid().optional(),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ...mcpToolAuthMetadata(["vcstudio:media"]),
        ui: { resourceUri: MCP_UPLOAD_RESOURCE },
      },
    },
    async (args) => {
      try {
        const p = z
            .object({ workspaceId: z.uuid(), uploadId: z.uuid().optional() })
            .parse(args),
          ctx = await authorizeMcp(principal, p.workspaceId, "vcstudio:media");
        await enforceMcpRateLimit(ctx, "read");
        const resumeSession = p.uploadId
          ? await mcpUploadSession(
              ctx,
              await findOwnedMcpUpload(ctx, p.uploadId),
            )
          : undefined;
        return toolResult({
          workspaceId: ctx.workspaceId,
          resumeUploadId: p.uploadId,
          resumeSession,
          serverVersion: MCP_SERVER_VERSION,
          limits: mcpUploadLimits(),
        });
      } catch (error) {
        return toolError(error);
      }
    },
  );
  registerAppResource(
    server,
    "Upload media in chat",
    MCP_UPLOAD_RESOURCE,
    {
      description:
        "Choose original media and upload it privately using MCP without leaving chat.",
    },
    async () => ({
      contents: [
        {
          uri: MCP_UPLOAD_RESOURCE,
          mimeType: RESOURCE_MIME_TYPE,
          text: await readFile(
            path.join(process.cwd(), "public", "mcp", "upload.html"),
            "utf8",
          ),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: { connectDomains: [], resourceDomains: [] },
            },
          },
        },
      ],
    }),
  );
}
