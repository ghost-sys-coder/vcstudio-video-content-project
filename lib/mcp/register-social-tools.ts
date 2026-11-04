import { z } from "zod";
import {
  mcpMutationInput,
  mcpPageInput,
  mcpWorkspaceInput,
} from "@studio/contracts";
import { createSocialPost } from "@/db/commands/social-post-commands";
import {
  findSocialPost,
  listSocialPostMedia,
  listSocialPostTargets,
} from "@/db/repositories/social-posts.repository";
import { listPlatformConnections } from "@/db/repositories/publishing.repository";
import { listMcpPosts } from "@/db/repositories/mcp-content.repository";
import { saveAuthorizedSocialDraft } from "@/lib/social/save-social-draft";
import { portableDocumentSchema } from "@/lib/social/portable-document";
import { requireMcpProject } from "./project-access";
import { requireMcp } from "./errors";
import { mutateOnce } from "./operations";
import type { McpToolRegistrar } from "./register-tool";

export function registerSocialTools(register: McpToolRegistrar) {
  register(
    "list_destinations",
    "List existing connected publishing accounts. This cannot authorize new accounts or enable paused features.",
    "vcstudio:read",
    mcpWorkspaceInput,
    true,
    async (ctx) =>
      (await listPlatformConnections({ workspaceId: ctx.workspaceId })).map(
        (c) => ({
          id: c.id,
          platform: c.platform,
          name: c.externalAccountName,
          status: c.status,
          expiresAt: c.accessTokenExpiresAt,
        }),
      ),
  );
  register(
    "list_posts",
    "Read a bounded page of Social posts and their current versions.",
    "vcstudio:read",
    mcpPageInput,
    true,
    async (ctx, p) => {
      const rows = await listMcpPosts({ ...p, workspaceId: ctx.workspaceId });
      return {
        items: rows.slice(0, p.pageSize),
        nextPage: rows.length > p.pageSize ? p.page + 1 : null,
      };
    },
  );
  register(
    "get_calendar",
    "Read scheduled posts in an explicit date range of at most 31 days.",
    "vcstudio:read",
    mcpPageInput.extend({
      from: z.iso.datetime({ offset: true }),
      to: z.iso.datetime({ offset: true }),
    }),
    true,
    async (ctx, p) => {
      const from = new Date(p.from),
        to = new Date(p.to);
      requireMcp(
        to > from && to.getTime() - from.getTime() <= 31 * 86400_000,
        "invalid_input",
        "Choose a calendar range of up to 31 days.",
      );
      const rows = await listMcpPosts({
        ...p,
        workspaceId: ctx.workspaceId,
        from,
        to,
      });
      return {
        items: rows.slice(0, p.pageSize),
        nextPage: rows.length > p.pageSize ? p.page + 1 : null,
      };
    },
  );
  register(
    "get_post",
    "Read a post's exact text, attachments and safe per-destination publication results.",
    "vcstudio:read",
    mcpWorkspaceInput.extend({ postId: z.uuid() }),
    true,
    async (ctx, p) => {
      const post = await findSocialPost({
        workspaceId: ctx.workspaceId,
        postId: p.postId,
      });
      requireMcp(post, "not_found", "That post is unavailable.");
      const [media, targets] = await Promise.all([
        listSocialPostMedia({ workspaceId: ctx.workspaceId, postId: p.postId }),
        listSocialPostTargets({
          workspaceId: ctx.workspaceId,
          postId: p.postId,
        }),
      ]);
      return {
        id: post.id,
        name: post.name,
        text: post.bodyPlainText,
        version: post.version,
        status: post.status,
        scheduledAt: post.scheduledAt,
        timezone: post.scheduledTimezone,
        attachments: media.map((a) => ({
          source: a.source,
          id: a.sourceId,
          kind: a.kind,
          title: a.title,
          unavailable: a.unavailable,
        })),
        targets: targets.map((t) => ({
          id: t.id,
          connectionId: t.connectionId,
          platform: t.platform,
          status: t.status,
          error: t.safeErrorMessage,
          externalPostUrl: t.externalPostUrl,
        })),
      };
    },
  );
  register(
    "create_post",
    "Create an empty Social draft. A video project is optional and no publication occurs.",
    "vcstudio:edit",
    mcpMutationInput.extend({
      name: z.string().max(120).default(""),
      projectId: z.uuid().nullable().default(null),
    }),
    false,
    async (ctx, p) => {
      if (p.projectId)
        await requireMcpProject(ctx, p.projectId, "composePosts");
      return mutateOnce(ctx, "create_post", p.idempotencyKey, p, async () => {
        const post = await createSocialPost({
          workspaceId: ctx.workspaceId,
          name: p.name,
          projectId: p.projectId,
          createdByUserId: ctx.principal.userId,
        });
        return { postId: post.id, version: post.version };
      });
    },
  );
  register(
    "save_post",
    "Save exact plain-text post copy and an ordered list of workspace library assets. Requires the current version. Does not publish.",
    "vcstudio:edit",
    mcpMutationInput.extend({
      postId: z.uuid(),
      expectedVersion: z.number().int().positive(),
      name: z.string().max(120),
      text: z.string().max(20000),
      mediaAssetIds: z
        .array(z.uuid())
        .max(20)
        .refine((v) => new Set(v).size === v.length)
        .default([]),
    }),
    false,
    async (ctx, p) =>
      mutateOnce(ctx, "save_post", p.idempotencyKey, p, async () => {
        const bodyDocument = portableDocumentSchema.parse({
          type: "doc",
          content: p.text.split("\n").map((text) => ({
            type: "paragraph",
            content: text ? [{ type: "text", text }] : [],
          })),
        });
        const saved = await saveAuthorizedSocialDraft(
          { workspaceId: ctx.workspaceId, role: ctx.membership.role },
          {
            postId: p.postId,
            expectedVersion: p.expectedVersion,
            name: p.name,
            bodyDocument,
            attachments: p.mediaAssetIds.map((id) => ({
              source: "library",
              id,
            })),
          },
        );
        requireMcp(
          saved.outcome === "updated",
          "conflict",
          "This post changed or is no longer editable. Read it before retrying.",
        );
        return {
          postId: saved.post.id,
          version: saved.post.version,
          text: saved.post.bodyPlainText,
        };
      }),
  );
}
