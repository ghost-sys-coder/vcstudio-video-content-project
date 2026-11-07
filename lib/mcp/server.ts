import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/server";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import {
  MCP_SCOPES,
  mcpPublishInput,
  mcpWorkspaceInput,
  mcpMutationInput,
  type McpPrincipal,
} from "@studio/contracts";
import {
  ensureMcpConnection,
  listMcpGrants,
} from "@/db/repositories/mcp.repository";
import { listWorkspaceMemberships } from "@/db/repositories/workspaces.repository";
import { authorizeMcp } from "./context";
import {
  prepareMcpPublication,
  approveMcpPublication,
  executeMcpPublication,
} from "./publishing-service";
import { createToolRegistrar, toolError, toolResult } from "./register-tool";
import { registerContentTools } from "./register-content-tools";
import { registerAssetTools } from "./register-asset-tools";
import { registerSocialTools } from "./register-social-tools";
import { mcpBaseUrl } from "./config";
import { enforceMcpRateLimit } from "./rate-limit";
import {
  getMcpMediaPreviewOrigin,
  loadMcpMediaPreviews,
} from "./media-previews";
import { getPublishingEnvironment } from "@/lib/env/server";
import { roleAllowsScope } from "./policy";
import { effectivePublicationApprovalMode } from "./publication-approval-policy";

const REVIEW_URI = "ui://vcstudio/publication-review.html";
export function createVcStudioMcpServer(principal: McpPrincipal) {
  const server = new McpServer(
    { name: "VCStudio", version: "1.0.0" },
    {
      instructions:
        "Use get_connection first and an explicitly granted workspaceId on every action. Read current revisions before edits. Imports never approve media or publish. Check get_capabilities for publicationApprovalMode. prepare_publication only prepares an immutable preview. Manual connections require human review; owner-authorized autonomous connections may call execute_publication with the prepared operation ID and the same idempotency key. Never fabricate file access, approval proof, success or a supported platform. Internal approvals stay explicit. Marketing is paused. AI generation and administration are unavailable. Reuse idempotency keys when retrying the same action.",
    },
  );
  const register = createToolRegistrar(server, principal);
  server.registerTool(
    "get_connection",
    {
      description:
        "Inspect your VCStudio AI connection and get the signed-in setup link. This grants no workspace access.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const connection = await ensureMcpConnection(
          principal.userId,
          principal.clientId,
        );
        return toolResult({
          connectionId: connection.id,
          revoked: !!connection.revokedAt,
          setupUrl: `${mcpBaseUrl()}/app/settings/mcp`,
          marketing: "paused",
          generation: "not_exposed",
        });
      } catch (e) {
        return toolError(e);
      }
    },
  );
  server.registerTool(
    "list_workspaces",
    {
      description:
        "List only currently granted workspaces, their roles and effective scopes. Does not grant access.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const connection = await ensureMcpConnection(
          principal.userId,
          principal.clientId,
        );
        if (connection.revokedAt)
          return toolResult({
            items: [],
            setupUrl: `${mcpBaseUrl()}/app/settings/mcp`,
          });
        const [memberships, grants] = await Promise.all([
          listWorkspaceMemberships(principal.userId),
          listMcpGrants(connection.id),
        ]);
        return toolResult({
          items: memberships
            .filter(
              (m) =>
                grants.some(
                  (g) =>
                    g.workspaceId === m.workspaceId &&
                    g.scopes.includes("vcstudio:read"),
                ) && principal.scopes.includes("vcstudio:read"),
            )
            .slice(0, 50)
            .map((m) => ({
              ...m,
              scopes: MCP_SCOPES.filter(
                (s) =>
                  grants
                    .find((g) => g.workspaceId === m.workspaceId)
                    ?.scopes.includes(s) &&
                  principal.scopes.includes(s) &&
                  roleAllowsScope(m.role, s),
              ),
            })),
        });
      } catch (e) {
        return toolError(e);
      }
    },
  );
  registerContentTools(register);
  register(
    "get_capabilities",
    "Inspect current effective permissions and feature availability without starting work.",
    "vcstudio:read",
    mcpWorkspaceInput,
    true,
    async (ctx) => ({
      scopes: MCP_SCOPES.filter(
        (s) =>
          ctx.grant.scopes.includes(s) &&
          principal.scopes.includes(s) &&
          roleAllowsScope(ctx.membership.role, s),
      ),
      features: {
        imports: true,
        sceneImageReuse: true,
        socialPublishing: getPublishingEnvironment().ENABLE_SOCIAL_POSTING,
        marketing: false,
        linkedinPages: false,
        generation: false,
        administration: false,
        youtubeUploadMetadata: true,
        youtubeCustomThumbnails: true,
        youtubeThumbnailRetry: true,
        tiktokDelivery: "inbox_only",
        tiktokCoverSelection: "finish_in_tiktok",
        tiktokCaptions: "finish_in_tiktok",
        tiktokDirectPost: false,
      },
      transfers: [
        "client_file_reference_when_supported",
        "public_https_download",
        "signed_in_upload_handoff",
      ],
      approval: ["mcp_app_when_supported", "signed_in_browser"],
      publicationApprovalMode: effectivePublicationApprovalMode({
        publicationApprovalMode: ctx.grant.publicationApprovalMode,
        role: ctx.membership.role,
      }),
    }),
  );
  registerAssetTools(register);
  registerSocialTools(register);
  register(
    "execute_publication",
    "Execute an exact prepared publication, schedule, cancellation or thumbnail retry ONLY when this connection/workspace has owner-enabled autonomous publishing. First call prepare_publication; supply that operationId and its SAME idempotencyKey. Manual connections require human review and cannot use this tool. Retries return the existing operation; content or permission changes require a fresh preparation. This cannot enable autonomy or change internal approvals.",
    "vcstudio:publish",
    mcpMutationInput.extend({ operationId: z.uuid() }),
    false,
    (ctx, p) => executeMcpPublication(ctx, p.operationId, p.idempotencyKey),
  );
  registerAppTool(
    server,
    "prepare_publication",
    {
      description:
        "Save chosen destination accounts and prepare an immutable publish/schedule preview; this never publishes by itself. The returned approvalMode determines the next step: manual needs human review, autonomous permits execute_publication using this operation ID and the same idempotency key. Includes saved YouTube metadata, explicit creator disclosures and a separate thumbnail; save these with save_post first. TikTok is inbox-only: finish caption, cover and posting in TikTok; it cannot be scheduled here. This can advance the draft revision. cancel_schedule requires current version and exact destination IDs. retry_thumbnail requires one existing YouTube destination, current version and no scheduledAt; never upload the video again to fix a thumbnail.",
      inputSchema: mcpPublishInput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: { ui: { resourceUri: REVIEW_URI } },
    },
    async (args) => {
      try {
        const input = mcpPublishInput.parse(args);
        const context = await authorizeMcp(
          principal,
          input.workspaceId,
          "vcstudio:publish",
        );
        await enforceMcpRateLimit(context, "write");
        const prepared = await prepareMcpPublication(context, input);
        return {
          ...toolResult({
            operation: prepared.operation,
            preview: prepared.preview,
            approvalMode: prepared.approvalMode ?? "manual",
            approvalUrl: `${mcpBaseUrl()}${prepared.operation.href}`,
          }),
          _meta: {
            approvalProof: prepared.uiProof,
            operationId: prepared.operation.id,
            workspaceId: input.workspaceId,
            mediaPreviews: await loadMcpMediaPreviews(
              context.workspaceId,
              prepared.preview,
            ),
          },
        };
      } catch (e) {
        return toolError(e);
      }
    },
  );
  registerAppTool(
    server,
    "confirm_publication",
    {
      description:
        "User-interface-only publication approval. Requires the private single-use review proof; never call from model reasoning.",
      inputSchema: mcpWorkspaceInput.extend({
        operationId: z.uuid(),
        proof: z.string().min(32).max(128),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
      _meta: { ui: { visibility: ["app"] } },
    },
    async (args) => {
      try {
        const p = mcpWorkspaceInput
          .extend({ operationId: z.uuid(), proof: z.string().min(32).max(128) })
          .parse(args);
        const ctx = await authorizeMcp(
          principal,
          p.workspaceId,
          "vcstudio:publish",
        );
        return toolResult(
          await approveMcpPublication(ctx, p.operationId, p.proof),
        );
      } catch (e) {
        return toolError(e);
      }
    },
  );
  registerAppResource(
    server,
    "Publication review",
    REVIEW_URI,
    {
      description:
        "Review exact content and destinations before confirming publication.",
    },
    async () => ({
      contents: [
        {
          uri: REVIEW_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: await readFile(
            path.join(process.cwd(), "public", "mcp", "review.html"),
            "utf8",
          ),
          _meta: {
            ui: {
              prefersBorder: true,
              csp: {
                connectDomains: [],
                resourceDomains: [await getMcpMediaPreviewOrigin()],
              },
            },
          },
        },
      ],
    }),
  );
  return server;
}
