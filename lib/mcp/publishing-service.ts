import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  mcpPublishInput,
  publicationPreviewSchema,
  type PublicationPreview,
} from "@studio/contracts";
import {
  findSocialPost,
  listSocialPostMedia,
  listSocialPostTargets,
} from "@/db/repositories/social-posts.repository";
import { findPlatformConnectionSummary } from "@/db/repositories/publishing.repository";
import { findReadyMediaAssets } from "@/db/repositories/media-assets.repository";
import {
  beginMcpOperation,
  consumeMcpApproval,
  findMcpOperation,
  findMcpOperationByKey,
  updateMcpOperation,
  type McpOperation,
} from "@/db/repositories/mcp.repository";
import { lockMcpPost, unlockMcpPost } from "@/db/commands/mcp-post-lock";
import { isSocialPostPlatform } from "@/lib/social/platform-post-capabilities";
import {
  checkPlatformEligibility,
  summarizeAttachments,
} from "@/lib/social/select-eligible-platforms";
import { checkVerifiedVideoCompatibility } from "@/lib/social/video-platform-compatibility";
import { isSocialPostPlatformConfigured } from "@/lib/publishing/social-post-registry";
import { isRepublishableStatus } from "@/db/commands/social-post-commands";
import { startSocialPostPublication } from "@/lib/social/start-social-post-publication";
import {
  scheduleSocialPostPublication,
  cancelSocialPostPublication,
} from "@/lib/social/schedule-social-post";
import { checkScheduleInstant } from "@/lib/social/schedule-window";
import { getPublishingEnvironment } from "@/lib/env/server";
import type { McpContext } from "./context";
import { fingerprint } from "./fingerprint";
import { publicOperation } from "./operations";
import { requireMcp, McpError } from "./errors";
import { safeEquals } from "@/lib/crypto/secret-box";
import { mcpObjectEtag } from "./storage-integrity";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";

export function publicationAuthority(context: McpContext) {
  return fingerprint({
    userId: context.principal.userId,
    connectionId: context.connection.id,
    connectionRevision: context.connection.updatedAt.toISOString(),
    grantRevision: context.grant.updatedAt.toISOString(),
    scopes: [...context.grant.scopes].sort(),
    role: context.membership.role,
  });
}

export async function buildPublicationPreview(
  context: Pick<McpContext, "workspaceId">,
  input: z.infer<typeof mcpPublishInput>,
): Promise<PublicationPreview> {
  requireMcp(
    getPublishingEnvironment().ENABLE_SOCIAL_POSTING,
    "feature_disabled",
    "Social publishing is disabled.",
  );
  const [post, media] = await Promise.all([
    findSocialPost({ workspaceId: context.workspaceId, postId: input.postId }),
    listSocialPostMedia({
      workspaceId: context.workspaceId,
      postId: input.postId,
    }),
  ]);
  if (input.action === "cancel_schedule") {
    requireMcp(
      post?.status === "scheduled" &&
        post.version === input.expectedVersion &&
        post.scheduledAt,
      "conflict",
      "This schedule changed or publication already started.",
    );
    const targets = await listSocialPostTargets({
      workspaceId: context.workspaceId,
      postId: input.postId,
    });
    requireMcp(
      fingerprint(targets.map((t) => t.connectionId).sort()) ===
        fingerprint([...input.connectionIds].sort()),
      "conflict",
      "The schedule destinations changed. Read the post again.",
    );
    const destinations = await Promise.all(
      targets.map(async (t) => {
        const account = await findPlatformConnectionSummary({
          workspaceId: context.workspaceId,
          connectionId: t.connectionId,
        });
        return {
          id: t.connectionId,
          platform: t.platform,
          name: account?.externalAccountName ?? "Disconnected account",
          text: t.overrideBodyPlainText ?? post.bodyPlainText,
        };
      }),
    );
    return {
      action: "cancel_schedule",
      postId: post.id,
      version: post.version,
      text: post.bodyPlainText,
      media: media.map((a) => ({
        id: a.sourceId,
        name: a.title,
        kind: a.kind,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
        etag: null,
      })),
      destinations,
      scheduledAt: post.scheduledAt.toISOString(),
      timezone: post.scheduledTimezone,
    };
  }
  requireMcp(
    post &&
      post.version === input.expectedVersion &&
      isRepublishableStatus(post.status),
    "conflict",
    "This post changed or is already publishing. Read it again and prepare a fresh preview.",
  );
  requireMcp(
    media.every((a) => !a.unavailable),
    "invalid_media",
    "A post attachment is unavailable.",
  );
  const libraryIds = media
    .filter((a) => a.source === "library")
    .map((a) => a.sourceId);
  const assets = await findReadyMediaAssets({
    workspaceId: context.workspaceId,
    mediaAssetIds: libraryIds,
  });
  requireMcp(
    assets.length === libraryIds.length,
    "inspection_pending",
    "Wait for every attachment to finish verification.",
  );
  const destinations = [];
  const previousTargets = await listSocialPostTargets({
    workspaceId: context.workspaceId,
    postId: input.postId,
  });
  for (const connectionId of input.connectionIds) {
    requireMcp(
      !previousTargets.some(
        (t) => t.connectionId === connectionId && t.status === "published",
      ),
      "already_published",
      "A selected account already received this post. Choose only the failed or unsent destinations.",
    );
    const connection = await findPlatformConnectionSummary({
      workspaceId: context.workspaceId,
      connectionId,
    });
    requireMcp(
      connection?.status === "active" &&
        isSocialPostPlatform(connection.platform),
      "destination_unavailable",
      "Reconnect the selected publishing destination.",
    );
    requireMcp(
      !(
        connection.platform === "linkedin" &&
        connection.externalAccountId.startsWith("urn:li:organization:")
      ),
      "feature_paused",
      "LinkedIn Pages is on hold pending developer-app approval.",
    );
    requireMcp(
      isSocialPostPlatformConfigured(connection.platform, connection),
      "destination_unavailable",
      "That platform is not configured.",
    );
    const eligibility = checkPlatformEligibility({
      platform: connection.platform,
      attachments: summarizeAttachments(media.map((a) => a.kind)),
      plainTextLength: post.bodyPlainText.length,
    });
    requireMcp(
      eligibility.eligible,
      "incompatible_destination",
      eligibility.eligible ? "" : eligibility.reason,
    );
    for (const asset of assets.filter((a) => a.kind === "video")) {
      const compatible = checkVerifiedVideoCompatibility({
        platform: connection.platform,
        metadata: asset.verifiedMetadata,
      });
      requireMcp(
        compatible.compatible,
        "incompatible_destination",
        compatible.compatible ? "" : compatible.reason,
      );
    }
    requireMcp(
      !(input.scheduledAt && connection.platform === "tiktok"),
      "incompatible_destination",
      "TikTok inbox delivery requires consent at send time and cannot be scheduled through MCP.",
    );
    destinations.push({
      id: connection.id,
      platform: connection.platform,
      name: connection.externalAccountName,
      text: post.bodyPlainText,
    });
  }
  if (input.scheduledAt) {
    const check = checkScheduleInstant({
      scheduledAt: new Date(input.scheduledAt),
    });
    requireMcp(
      check.valid,
      "invalid_schedule",
      check.valid ? "" : check.reason,
    );
    try {
      new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format();
    } catch {
      throw new McpError("invalid_schedule", "Choose a valid IANA timezone.");
    }
  }
  return {
    postId: post.id,
    version: post.version,
    text: post.bodyPlainText,
    media: await Promise.all(
      media.map(async (a) => ({
        id: a.sourceId,
        name: a.title,
        kind: a.kind,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
        etag: fingerprint({
          etag: await mcpObjectEtag(a.objectKey),
          objectKey: a.objectKey,
          size: a.sizeBytes,
          title: a.title,
          alt: a.altText,
          verified: assets.find((v) => v.id === a.sourceId)?.verifiedMetadata,
        }),
      })),
    ),
    destinations,
    scheduledAt: input.scheduledAt
      ? new Date(input.scheduledAt).toISOString()
      : null,
    timezone: input.timezone,
  };
}
export async function prepareMcpPublication(
  context: McpContext,
  input: z.infer<typeof mcpPublishInput>,
) {
  const previous = await findMcpOperationByKey(
    context.connection.id,
    context.workspaceId,
    input.idempotencyKey,
  );
  if (previous) {
    requireMcp(
      previous.kind === "publish_post" &&
        fingerprint(previous.input.request) === fingerprint(input),
      "conflict",
      "That request key belongs to a different preview.",
    );
    return {
      operation: publicOperation(previous),
      preview: publicationPreviewSchema.parse(previous.input.preview),
      uiProof: undefined,
    };
  }
  const preview = await buildPublicationPreview(context, input);
  const proof = randomBytes(32).toString("base64url");
  const authority = publicationAuthority(context);
  const digest = fingerprint({
    kind: "publish_post",
    input,
    preview,
    authority,
  });
  const started = await beginMcpOperation({
    workspaceId: context.workspaceId,
    connectionId: context.connection.id,
    userId: context.principal.userId,
    kind: "publish_post",
    idempotencyKey: input.idempotencyKey,
    fingerprint: digest,
    input: { request: input, preview, authority },
    status: "requires_approval",
    approvalHash: fingerprint(proof),
    expiresAt: new Date(Date.now() + 600_000),
  });
  requireMcp(
    started.operation.fingerprint === digest,
    "conflict",
    "That request key belongs to a different preview. Prepare a new request.",
  );
  // Only the UI receives the proof. Repeated preparation never reissues it;
  // browser approval remains available after a client reload.
  return {
    operation: publicOperation(started.operation),
    preview,
    uiProof: started.created ? proof : undefined,
  };
}
export async function approveMcpPublication(
  context: McpContext,
  operationId: string,
  proof?: string,
  browser = false,
) {
  requireMcp(
    browser || proof,
    "approval_required",
    "Approve this action using the review panel.",
  );
  const op = await findMcpOperation({
    workspaceId: context.workspaceId,
    operationId,
    userId: context.principal.userId,
    connectionId: context.connection.id,
  });
  requireMcp(
    op?.kind === "publish_post" &&
      op.expiresAt > new Date() &&
      op.status === "requires_approval",
    "expired",
    "This approval expired or was already used.",
  );
  const request = mcpPublishInput.parse(op.input.request);
  requireMcp(
    op.input.authority === publicationAuthority(context),
    "conflict",
    "Connection permissions changed. Prepare a fresh preview.",
  );
  requireMcp(
    browser ||
      (op.approvalHash && safeEquals(op.approvalHash, fingerprint(proof))),
    "approval_required",
    "This approval proof is invalid. Use the review panel or browser approval page.",
  );
  const expected = publicationPreviewSchema.parse(op.input.preview);
  const current = await buildPublicationPreview(context, request);
  requireMcp(
    fingerprint(current) === fingerprint(expected),
    "conflict",
    "The post, media or account changed. Prepare a fresh preview.",
  );
  const locked = await lockMcpPost({
    workspaceId: context.workspaceId,
    postId: request.postId,
    expectedVersion: request.expectedVersion,
    operationId,
    cancellation: request.action === "cancel_schedule",
  });
  requireMcp(
    locked,
    "conflict",
    "The post changed or has another publication in progress.",
  );
  const approved = await consumeMcpApproval({
    workspaceId: context.workspaceId,
    operationId,
    userId: context.principal.userId,
    connectionId: context.connection.id,
    approvalHash: browser ? undefined : fingerprint(proof),
  });
  if (!approved) {
    await unlockMcpPost(context.workspaceId, request.postId, operationId);
    throw new McpError(
      "approval_required",
      "This approval is invalid or no longer available.",
    );
  }
  return dispatchApprovedPublication(approved);
}
export async function dispatchApprovedPublication(op: McpOperation) {
  requireMcp(
    op.status === "approved",
    "invalid_state",
    "Publication has not been approved.",
  );
  // A committed human approval is a durable outbox entry. Disconnecting the AI
  // client must not revoke content already approved for the Social calendar.
  const context = { workspaceId: op.workspaceId };
  const request = mcpPublishInput.parse(op.input.request);
  try {
    const existing = await listSocialPostTargets({
      workspaceId: op.workspaceId,
      postId: request.postId,
    });
    const post = await findSocialPost({
      workspaceId: op.workspaceId,
      postId: request.postId,
    });
    // An approved outbox entry survives dispatch interruption. Never replace
    // targets once sending has begun; report their persisted outcomes instead.
    const cancellationCompleted =
      request.action === "cancel_schedule" &&
      post?.mcpOperationId === op.id &&
      post.status === "draft" &&
      !post.scheduledAt;
    const alreadyStarted =
      cancellationCompleted ||
      (request.action !== "cancel_schedule" &&
        post?.mcpOperationId === op.id &&
        (post.status === "scheduled" ||
          existing.some(
            (t) =>
              request.connectionIds.includes(t.connectionId) &&
              ["queued", "publishing", "published"].includes(t.status),
          )));
    if (!alreadyStarted) {
      const preview = await buildPublicationPreview(context, request);
      requireMcp(
        fingerprint(preview) === fingerprint(op.input.preview),
        "conflict",
        "The approved publication is stale. Prepare a new preview.",
      );
      const common = {
        workspaceId: op.workspaceId,
        postId: request.postId,
        connectionIds: request.connectionIds,
        requestNonce: op.id,
        mcpOperationId: op.id,
      };
      if (request.action === "cancel_schedule")
        await cancelSocialPostPublication({
          ...common,
          expectedVersion: request.expectedVersion,
        });
      else if (request.scheduledAt)
        await scheduleSocialPostPublication({
          ...common,
          scheduledAt: new Date(request.scheduledAt),
          timezone: request.timezone,
        });
      else await startSocialPostPublication(common);
    }
    const row = await updateMcpOperation({
      operationId: op.id,
      workspaceId: op.workspaceId,
      from: ["approved"],
      values: {
        status: "succeeded",
        result: {
          postId: request.postId,
          scheduled:
            request.action !== "cancel_schedule" && !!request.scheduledAt,
          cancelled: request.action === "cancel_schedule",
          href: `/app/social/posts/${request.postId}`,
        },
      },
    });
    await unlockMcpPost(op.workspaceId, request.postId, op.id);
    await recordAuditEvent({
      workspaceId: op.workspaceId,
      actorUserId: op.userId,
      action: "mcp_action_completed",
      targetType: "mcp_operation",
      targetId: op.id,
      metadata: { kind: op.kind },
    });
    return publicOperation(row ?? op);
  } catch (error) {
    const row = await updateMcpOperation({
      operationId: op.id,
      workspaceId: op.workspaceId,
      from: ["approved"],
      values: {
        status: "failed",
        error:
          error instanceof McpError
            ? error.message
            : "Publication could not be completed. Inspect the per-destination results before retrying.",
      },
    });
    await unlockMcpPost(op.workspaceId, request.postId, op.id);
    await recordAuditEvent({
      workspaceId: op.workspaceId,
      actorUserId: op.userId,
      action: "mcp_action_failed",
      targetType: "mcp_operation",
      targetId: op.id,
      metadata: { kind: op.kind },
    });
    return publicOperation(row ?? op);
  }
}
