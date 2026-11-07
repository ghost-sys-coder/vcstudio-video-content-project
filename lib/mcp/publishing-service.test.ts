import { beforeEach, describe, expect, it, vi } from "vitest";
import { socialYouTubeSettingsSchema } from "@studio/contracts/publishing";
import { mcpObjectEtag } from "./storage-integrity";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: vi.fn(),
}));
vi.mock("./storage-integrity", () => ({
  mcpObjectEtag: vi.fn().mockResolvedValue("etag-1"),
}));
const m = vi.hoisted(() => ({
  post: vi.fn(),
  media: vi.fn(),
  targets: vi.fn(),
  connection: vi.fn(),
  assets: vi.fn(),
  begin: vi.fn(),
  find: vi.fn(),
  findKey: vi.fn(),
  update: vi.fn(),
  consume: vi.fn(),
  consumeAutonomous: vi.fn(),
  lock: vi.fn(),
  unlock: vi.fn(),
  publish: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
  draftDestinations: vi.fn(),
  prepareDestinations: vi.fn(),
  retryThumbnail: vi.fn(),
}));
vi.mock("@/lib/social/retry-youtube-thumbnail", () => ({
  retrySocialYouTubeThumbnail: m.retryThumbnail,
}));
vi.mock("@/db/repositories/social-post-destinations.repository", () => ({
  listSocialPostDraftConnectionIds: m.draftDestinations,
}));
vi.mock("@/db/commands/mcp-publication-destinations", () => ({
  beginMcpPublicationWithDestinations: m.prepareDestinations,
}));
vi.mock("@/db/repositories/social-posts.repository", () => ({
  findSocialPost: m.post,
  listSocialPostMedia: m.media,
  listSocialPostTargets: m.targets,
}));
vi.mock("@/db/repositories/publishing.repository", () => ({
  findPlatformConnectionSummary: m.connection,
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findReadyMediaAssets: m.assets,
}));
vi.mock("@/db/repositories/mcp.repository", () => ({
  beginMcpOperation: m.begin,
  findMcpOperation: m.find,
  findMcpOperationByKey: m.findKey,
  updateMcpOperation: m.update,
  consumeMcpApproval: m.consume,
  consumeMcpAutonomousPublication: m.consumeAutonomous,
}));
vi.mock("@/db/commands/mcp-post-lock", () => ({
  lockMcpPost: m.lock,
  unlockMcpPost: m.unlock,
}));
vi.mock("@/lib/social/start-social-post-publication", () => ({
  startSocialPostPublication: m.publish,
}));
vi.mock("@/lib/social/schedule-social-post", () => ({
  scheduleSocialPostPublication: m.schedule,
  cancelSocialPostPublication: m.cancel,
}));
vi.mock("@/lib/publishing/social-post-registry", () => ({
  isSocialPostPlatformConfigured: () => true,
}));
vi.mock("@/lib/env/server", () => ({
  getPublishingEnvironment: () => ({ ENABLE_SOCIAL_POSTING: true }),
}));
import {
  approveMcpPublication,
  buildPublicationPreview,
  publicationAuthority,
  prepareMcpPublication,
  dispatchApprovedPublication,
  executeMcpPublication,
} from "./publishing-service";
import {
  mcpContextFixture,
  mcpIds,
  mcpOperationFixture,
} from "@/lib/test-utils/mcp-fixtures";
import { fingerprint } from "./fingerprint";
const ctx = mcpContextFixture();
const request = {
  workspaceId: mcpIds.workspace,
  idempotencyKey: "publish-request-1",
  postId: mcpIds.post,
  expectedVersion: 2,
  connectionIds: [mcpIds.destination],
  timezone: "UTC",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mcpObjectEtag).mockResolvedValue("etag-1");
  m.findKey.mockResolvedValue(null);
  m.draftDestinations.mockResolvedValue([mcpIds.destination]);
  m.prepareDestinations.mockImplementation(async (input) => ({
    created: true,
    operation: mcpOperationFixture(input),
  }));
  m.post.mockResolvedValue({
    id: mcpIds.post,
    version: 2,
    status: "draft",
    bodyPlainText: "Approved exact copy",
    mcpOperationId: null,
  });
  m.media.mockResolvedValue([]);
  m.targets.mockResolvedValue([]);
  m.assets.mockResolvedValue([]);
  m.connection.mockResolvedValue({
    id: mcpIds.destination,
    platform: "linkedin",
    status: "active",
    externalAccountId: "urn:li:person:member",
    externalAccountName: "My profile",
  });
  m.lock.mockResolvedValue({ id: mcpIds.post });
  m.unlock.mockResolvedValue(undefined);
  m.publish.mockResolvedValue({ dispatched: 1 });
  m.schedule.mockResolvedValue({ scheduledAt: new Date() });
  m.update.mockImplementation(async ({ values }) =>
    mcpOperationFixture(values),
  );
  m.begin.mockImplementation(async (values) => ({
    created: true,
    operation: mcpOperationFixture(values),
  }));
});
async function pendingOperation() {
  const preview = await buildPublicationPreview(ctx, request);
  return mcpOperationFixture({
    input: { request, preview, authority: publicationAuthority(ctx) },
    approvalHash: fingerprint("proof"),
    fingerprint: fingerprint({ kind: "publish_post", input: request, preview }),
  });
}
async function autonomousSetup(
  input: typeof request & { scheduledAt?: string } = request,
) {
  const context = mcpContextFixture();
  context.grant.publicationApprovalMode = "autonomous";
  const preview = await buildPublicationPreview(context, input);
  const operation = mcpOperationFixture({
    status: "prepared",
    approvalHash: null,
    idempotencyKey: input.idempotencyKey,
    input: {
      request: input,
      preview,
      authority: publicationAuthority(context),
      approvalMode: "autonomous",
    },
  });
  m.find.mockResolvedValue(operation);
  m.consumeAutonomous.mockResolvedValue({ ...operation, status: "approved" });
  return { context, operation };
}

describe("connection-preauthorized publishing", () => {
  it("prepares without a human proof or starting any publication", async () => {
    const context = mcpContextFixture();
    context.grant.publicationApprovalMode = "autonomous";
    const result = await prepareMcpPublication(context, request);
    expect(result).toMatchObject({
      approvalMode: "autonomous",
      operation: { status: "prepared" },
    });
    expect(result.uiProof).toBeUndefined();
    expect(m.begin).toHaveBeenCalledWith(
      expect.objectContaining({
        approvalHash: null,
        input: expect.objectContaining({ approvalMode: "autonomous" }),
      }),
    );
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("executes the frozen preview through the existing publication dispatcher", async () => {
    const { context, operation } = await autonomousSetup();
    const result = await executeMcpPublication(
      context,
      operation.id,
      request.idempotencyKey,
    );
    expect(result.status).toBe("succeeded");
    expect(m.consumeAutonomous).toHaveBeenCalledWith(
      expect.objectContaining({
        grantUpdatedAt: context.grant.updatedAt,
        connectionUpdatedAt: context.connection.updatedAt,
      }),
    );
    expect(m.publish).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        workspaceId: mcpIds.workspace,
        postId: mcpIds.post,
        requestNonce: operation.id,
      }),
    );
    expect(m.consume).not.toHaveBeenCalled();
  });
  it("keeps manual connections behind human approval", async () => {
    await expect(
      executeMcpPublication(ctx, mcpIds.operation, request.idempotencyKey),
    ).rejects.toMatchObject({ code: "approval_required" });
    expect(m.find).not.toHaveBeenCalled();
  });
  it("cannot execute a manually prepared operation after changing the connection mode", async () => {
    const { context, operation } = await autonomousSetup();
    m.find.mockResolvedValue({
      ...operation,
      status: "requires_approval",
      input: { ...operation.input, approvalMode: "manual" },
    });
    await expect(
      executeMcpPublication(context, operation.id, request.idempotencyKey),
    ).rejects.toMatchObject({ code: "approval_required" });
    expect(m.consumeAutonomous).not.toHaveBeenCalled();
  });
  it("rejects altered execution keys and expired preparations", async () => {
    const { context, operation } = await autonomousSetup();
    await expect(
      executeMcpPublication(context, operation.id, "different-key"),
    ).rejects.toMatchObject({ code: "conflict" });
    m.find.mockResolvedValue({ ...operation, expiresAt: new Date(0) });
    await expect(
      executeMcpPublication(context, operation.id, request.idempotencyKey),
    ).rejects.toMatchObject({ code: "expired" });
    expect(m.lock).not.toHaveBeenCalled();
  });
  it("invalidates a preview when content or permissions change", async () => {
    const { context, operation } = await autonomousSetup();
    context.grant.updatedAt = new Date(context.grant.updatedAt.getTime() + 1);
    await expect(
      executeMcpPublication(context, operation.id, request.idempotencyKey),
    ).rejects.toMatchObject({ code: "conflict" });
    context.grant.updatedAt = ctx.grant.updatedAt;
    m.find.mockResolvedValue({
      ...operation,
      input: { ...operation.input, authority: publicationAuthority(context) },
    });
    m.post.mockResolvedValue({
      id: mcpIds.post,
      version: 2,
      status: "draft",
      bodyPlainText: "Changed copy",
    });
    await expect(
      executeMcpPublication(context, operation.id, request.idempotencyKey),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(m.consumeAutonomous).not.toHaveBeenCalled();
  });
  it.each(["revoked", "token", "grant", "demoted"] as const)(
    "blocks execution after %s authority is lost",
    async (loss) => {
      const { context, operation } = await autonomousSetup();
      if (loss === "revoked") context.connection.revokedAt = new Date();
      if (loss === "token") context.principal.scopes = ["vcstudio:read"];
      if (loss === "grant") context.grant.scopes = ["vcstudio:read"];
      if (loss === "demoted") context.membership.role = "editor";
      await expect(
        executeMcpPublication(context, operation.id, request.idempotencyKey),
      ).rejects.toThrow();
      expect(m.publish).not.toHaveBeenCalled();
    },
  );
  it("does not dispatch when an atomic permission recheck loses the race", async () => {
    const { context, operation } = await autonomousSetup();
    m.consumeAutonomous.mockResolvedValue(null);
    await expect(
      executeMcpPublication(context, operation.id, request.idempotencyKey),
    ).rejects.toMatchObject({ code: "permission_denied" });
    expect(m.unlock).toHaveBeenCalledWith(
      mcpIds.workspace,
      mcpIds.post,
      operation.id,
    );
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("returns a completed execution on retry without sending again", async () => {
    const { context, operation } = await autonomousSetup();
    await executeMcpPublication(context, operation.id, request.idempotencyKey);
    m.find.mockResolvedValue({
      ...operation,
      status: "succeeded",
      result: { postId: request.postId },
    });
    expect(
      (
        await executeMcpPublication(
          context,
          operation.id,
          request.idempotencyKey,
        )
      ).status,
    ).toBe("succeeded");
    expect(m.publish).toHaveBeenCalledTimes(1);
  });
  it("schedules the exact frozen instant through the same dispatcher", async () => {
    const scheduledAt = new Date(Date.now() + 86_400_000).toISOString();
    const { context, operation } = await autonomousSetup({
      ...request,
      scheduledAt,
    });
    expect(
      (
        await executeMcpPublication(
          context,
          operation.id,
          request.idempotencyKey,
        )
      ).result?.scheduled,
    ).toBe(true);
    expect(m.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledAt: new Date(scheduledAt),
        timezone: "UTC",
      }),
    );
    expect(m.publish).not.toHaveBeenCalled();
  });
});

describe("publication approval boundary", () => {
  function useYouTube() {
    const youtubeSettings = socialYouTubeSettingsSchema.parse({
      title: "Exact title",
      description: "Exact YouTube description",
      madeForKids: false,
      containsSyntheticMedia: true,
      visibility: "unlisted",
      tags: ["VCStudio"],
    });
    m.post.mockResolvedValue({
      id: mcpIds.post,
      version: 2,
      status: "draft",
      bodyPlainText: "Approved exact copy",
      youtubeSettings,
      youtubeThumbnailAssetId: mcpIds.asset,
    });
    m.connection.mockResolvedValue({
      id: mcpIds.destination,
      platform: "youtube",
      status: "active",
      externalAccountName: "My channel",
      externalAccountId: "channel123",
    });
    m.media.mockResolvedValue([
      {
        source: "render",
        sourceId: "render-id",
        kind: "video",
        title: "Video",
        contentType: "video/mp4",
        sizeBytes: 1000,
        objectKey: `workspaces/${mcpIds.workspace}/video.mp4`,
        unavailable: false,
      },
    ]);
    m.assets.mockImplementation(async (input: { mediaAssetIds: string[] }) =>
      input.mediaAssetIds.includes(mcpIds.asset)
        ? [
            {
              id: mcpIds.asset,
              kind: "image",
              title: "Approved thumbnail",
              originalFileName: "thumbnail.png",
              contentType: "image/png",
              sizeBytes: 100,
              width: 1080,
              height: 1920,
              objectKey: `workspaces/${mcpIds.workspace}/thumbnail.png`,
            },
          ]
        : [],
    );
    return youtubeSettings;
  }
  it("previews exact YouTube metadata and a separate thumbnail without publishing", async () => {
    const settings = useYouTube();
    const prepared = await prepareMcpPublication(ctx, request);
    expect(prepared.preview.media).toHaveLength(1);
    expect(prepared.preview.media[0].kind).toBe("video");
    expect(prepared.preview.destinations[0]).toMatchObject({
      text: "Exact YouTube description",
      youtube: {
        ...settings,
        thumbnail: {
          id: mcpIds.asset,
          name: "Approved thumbnail",
          etag: expect.any(String),
        },
      },
    });
    expect(m.publish).not.toHaveBeenCalled();
    expect(m.assets).toHaveBeenCalledWith({
      workspaceId: mcpIds.workspace,
      mediaAssetIds: [mcpIds.asset],
    });
  });
  it("invalidates an approved preview when the thumbnail bytes change", async () => {
    useYouTube();
    const op = await pendingOperation();
    m.find.mockResolvedValue(op);
    vi.mocked(mcpObjectEtag).mockResolvedValue("different-thumbnail-bytes");
    await expect(
      approveMcpPublication(ctx, op.id, "proof"),
    ).rejects.toMatchObject({ code: "conflict" });
    expect(m.consume).not.toHaveBeenCalled();
  });
  it("requires a human proof for a thumbnail-only retry and never dispatches another upload", async () => {
    const settings = useYouTube();
    m.post.mockResolvedValue({
      id: mcpIds.post,
      version: 2,
      status: "published",
      bodyPlainText: "Approved exact copy",
    });
    m.targets.mockResolvedValue([
      {
        id: "target123",
        connectionId: mcpIds.destination,
        platform: "youtube",
        status: "published",
        externalPostId: "video123",
        youtubeSettings: settings,
        youtubeThumbnailAssetId: mcpIds.asset,
        youtubeThumbnailStatus: "failed",
      },
    ]);
    const retry = { ...request, action: "retry_thumbnail" as const };
    const prepared = await prepareMcpPublication(ctx, retry);
    expect(prepared.preview.destinations[0].existingVideoId).toBe("video123");
    expect(m.prepareDestinations).not.toHaveBeenCalled();
    const op = mcpOperationFixture({
      input: {
        request: retry,
        preview: prepared.preview,
        authority: publicationAuthority(ctx),
      },
      approvalHash: fingerprint("proof"),
    });
    m.find.mockResolvedValue(op);
    m.consume.mockResolvedValue({ ...op, status: "approved" });
    await expect(approveMcpPublication(ctx, op.id)).rejects.toMatchObject({
      code: "approval_required",
    });
    expect(m.retryThumbnail).not.toHaveBeenCalled();
    await approveMcpPublication(ctx, op.id, "proof");
    expect(m.retryThumbnail).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: mcpIds.post,
        connectionId: mcpIds.destination,
        requestNonce: op.id,
      }),
    );
    expect(m.publish).not.toHaveBeenCalled();
    expect(m.schedule).not.toHaveBeenCalled();
  });
  it("persists MCP-chosen draft accounts and advances the exact preview revision without dispatch", async () => {
    m.draftDestinations.mockResolvedValue([]);
    const result = await prepareMcpPublication(ctx, request);
    expect(m.prepareDestinations).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: request.postId,
        expectedVersion: 2,
        connectionIds: request.connectionIds,
        input: expect.objectContaining({
          originalRequest: request,
          request: { ...request, expectedVersion: 3 },
          preview: expect.objectContaining({ version: 3 }),
        }),
      }),
    );
    expect(result.preview.version).toBe(3);
    expect(m.begin).not.toHaveBeenCalled();
    expect(m.publish).not.toHaveBeenCalled();
    expect(m.schedule).not.toHaveBeenCalled();
  });
  it("returns the original-key preview after its saved destination revision changed", async () => {
    m.draftDestinations.mockResolvedValue([]);
    await prepareMcpPublication(ctx, request);
    const input = m.prepareDestinations.mock.calls[0]?.[0];
    m.findKey.mockResolvedValue(mcpOperationFixture(input));
    const retry = await prepareMcpPublication(ctx, request);
    expect(retry.preview.version).toBe(3);
    expect(retry.uiProof).toBeUndefined();
    expect(m.prepareDestinations).toHaveBeenCalledTimes(1);
    await expect(
      prepareMcpPublication(ctx, { ...request, expectedVersion: 3 }),
    ).rejects.toThrow("different preview");
  });
  it("rejects a concurrent destination edit instead of preparing an approval for the wrong revision", async () => {
    m.draftDestinations.mockResolvedValue([]);
    m.prepareDestinations.mockResolvedValue(null);
    await expect(prepareMcpPublication(ctx, request)).rejects.toThrow(
      "draft changed",
    );
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("prepares exact content without posting and returns a proof separately", async () => {
    const result = await prepareMcpPublication(ctx, request);
    expect(result.preview.text).toBe("Approved exact copy");
    expect(result.uiProof).toHaveLength(43);
    expect(result.operation).not.toHaveProperty("approvalHash");
    expect(m.publish).not.toHaveBeenCalled();
    expect(m.schedule).not.toHaveBeenCalled();
  });
  it.each(["stale_revision", "unique_key_race"])(
    "returns the winning same-key preview after %s without reissuing its proof",
    async (mode) => {
      m.draftDestinations.mockResolvedValue([]);
      const preview = {
        ...(await buildPublicationPreview(ctx, request)),
        version: 3,
      };
      const existing = mcpOperationFixture({
        input: {
          request: { ...request, expectedVersion: 3 },
          originalRequest: request,
          preview,
          authority: publicationAuthority(ctx),
        },
      });
      m.findKey.mockResolvedValueOnce(null).mockResolvedValue(existing);
      if (mode === "stale_revision")
        m.prepareDestinations.mockResolvedValue(null);
      else
        m.prepareDestinations.mockRejectedValue(new Error("Unique constraint"));
      const result = await prepareMcpPublication(ctx, request);
      expect(result.preview.version).toBe(3);
      expect(result.uiProof).toBeUndefined();
      expect(m.publish).not.toHaveBeenCalled();
      expect(m.schedule).not.toHaveBeenCalled();
    },
  );
  it("returns an existing immutable preparation after dispatch rather than recreating it", async () => {
    const op = await pendingOperation();
    m.findKey.mockResolvedValue({ ...op, status: "succeeded" });
    m.post.mockResolvedValue({ version: 3, status: "published" });
    const result = await prepareMcpPublication(ctx, request);
    expect(result.operation.status).toBe("succeeded");
    expect(result.uiProof).toBeUndefined();
    expect(m.begin).not.toHaveBeenCalled();
    await expect(
      prepareMcpPublication(ctx, { ...request, timezone: "Africa/Kampala" }),
    ).rejects.toThrow("different preview");
  });
  it("rejects model-only approval without a UI proof", async () => {
    await expect(approveMcpPublication(ctx, mcpIds.operation)).rejects.toThrow(
      "review panel",
    );
    expect(m.consume).not.toHaveBeenCalled();
  });
  it("rejects expired, replayed and unavailable operations", async () => {
    for (const op of [
      null,
      mcpOperationFixture({ expiresAt: new Date(0) }),
      mcpOperationFixture({ status: "succeeded" }),
    ]) {
      m.find.mockResolvedValue(op);
      await expect(
        approveMcpPublication(ctx, mcpIds.operation, "proof"),
      ).rejects.toThrow();
    }
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("refuses stale previews before consuming approval", async () => {
    m.find.mockResolvedValue(await pendingOperation());
    m.post.mockResolvedValue({
      id: mcpIds.post,
      version: 2,
      status: "draft",
      bodyPlainText: "Different text",
    });
    await expect(
      approveMcpPublication(ctx, mcpIds.operation, "proof"),
    ).rejects.toThrow("changed");
    expect(m.consume).not.toHaveBeenCalled();
  });
  it("rejects guessed proofs and concurrent approval retries without touching an active post lock", async () => {
    m.find.mockResolvedValue(await pendingOperation());
    await expect(
      approveMcpPublication(ctx, mcpIds.operation, "guessed-proof"),
    ).rejects.toThrow("proof is invalid");
    expect(m.lock).not.toHaveBeenCalled();
    expect(m.unlock).not.toHaveBeenCalled();
    m.lock.mockResolvedValue(null);
    await expect(
      approveMcpPublication(ctx, mcpIds.operation, "proof"),
    ).rejects.toThrow("publication in progress");
    expect(m.consume).not.toHaveBeenCalled();
    expect(m.unlock).not.toHaveBeenCalled();
  });
  it("unlocks a post when another session consumed the proof", async () => {
    m.find.mockResolvedValue(await pendingOperation());
    m.consume.mockResolvedValue(null);
    await expect(
      approveMcpPublication(ctx, mcpIds.operation, "proof"),
    ).rejects.toThrow("invalid");
    expect(m.unlock).toHaveBeenCalledWith(
      mcpIds.workspace,
      mcpIds.post,
      mcpIds.operation,
    );
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("binds the proof to the authenticated actor and calls the same dispatch path as browser approval", async () => {
    const op = await pendingOperation();
    m.find.mockResolvedValue(op);
    m.consume.mockResolvedValue({ ...op, status: "approved" });
    const result = await approveMcpPublication(ctx, op.id, "proof");
    expect(result.status).toBe("succeeded");
    expect(m.consume).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionId: ctx.connection.id,
        userId: ctx.principal.userId,
        approvalHash: fingerprint("proof"),
      }),
    );
    expect(m.publish).toHaveBeenCalledWith(
      expect.objectContaining({ requestNonce: op.id, mcpOperationId: op.id }),
    );
  });
  it("keeps an already-approved scheduled outbox entry independent of client revocation and does not reschedule", async () => {
    const op = await pendingOperation();
    m.post.mockResolvedValue({
      id: mcpIds.post,
      mcpOperationId: op.id,
      status: "scheduled",
    });
    await dispatchApprovedPublication({ ...op, status: "approved" });
    expect(m.publish).not.toHaveBeenCalled();
    expect(m.schedule).not.toHaveBeenCalled();
  });
  it("does not recreate targets after a dispatch interruption", async () => {
    const op = await pendingOperation();
    m.post.mockResolvedValue({
      id: mcpIds.post,
      mcpOperationId: op.id,
      status: "publishing",
    });
    m.targets.mockResolvedValue([
      { connectionId: mcpIds.destination, status: "queued" },
    ]);
    await dispatchApprovedPublication({ ...op, status: "approved" });
    expect(m.publish).not.toHaveBeenCalled();
  });
  it("rejects incompatible text-only destinations, pending media and already-published accounts", async () => {
    m.connection.mockResolvedValue({
      id: mcpIds.destination,
      platform: "youtube",
      status: "active",
      externalAccountName: "YouTube",
    });
    await expect(buildPublicationPreview(ctx, request)).rejects.toThrow();
    m.connection.mockResolvedValue({
      id: mcpIds.destination,
      platform: "linkedin",
      status: "active",
      externalAccountId: "person",
      externalAccountName: "Profile",
    });
    m.targets.mockResolvedValue([
      { connectionId: mcpIds.destination, status: "published" },
    ]);
    await expect(buildPublicationPreview(ctx, request)).rejects.toThrow(
      "already received",
    );
    m.targets.mockResolvedValue([]);
    m.media.mockResolvedValue([
      {
        source: "library",
        sourceId: mcpIds.asset,
        kind: "video",
        unavailable: false,
      },
    ]);
    await expect(buildPublicationPreview(ctx, request)).rejects.toThrow(
      "verification",
    );
  });
  it("refuses an attachment still undergoing inspection before preparing any approval", async () => {
    m.media.mockResolvedValue([
      {
        source: "library",
        sourceId: mcpIds.asset,
        kind: "video",
        unavailable: true,
        inspectionPending: true,
      },
    ]);
    await expect(buildPublicationPreview(ctx, request)).rejects.toThrow(
      "attachment is unavailable",
    );
    expect(m.publish).not.toHaveBeenCalled();
    expect(m.schedule).not.toHaveBeenCalled();
  });
  it("keeps LinkedIn Pages on hold even if credentials and a connection exist", async () => {
    m.connection.mockResolvedValue({
      id: mcpIds.destination,
      platform: "linkedin",
      status: "active",
      externalAccountId: "urn:li:organization:123",
    });
    await expect(buildPublicationPreview(ctx, request)).rejects.toThrow(
      "on hold",
    );
  });
  it("requires the same human approval for schedule cancellation and protects its exact version and destinations", async () => {
    m.post.mockResolvedValue({
      id: mcpIds.post,
      version: 2,
      status: "scheduled",
      bodyPlainText: "Approved exact copy",
      scheduledAt: new Date("2026-12-15T09:00:00Z"),
      scheduledTimezone: "Africa/Kampala",
    });
    m.targets.mockResolvedValue([
      {
        connectionId: mcpIds.destination,
        platform: "linkedin",
        overrideBodyPlainText: null,
      },
    ]);
    const input = { ...request, action: "cancel_schedule" as const };
    const prepared = await prepareMcpPublication(ctx, input);
    expect(prepared.preview.action).toBe("cancel_schedule");
    expect(m.cancel).not.toHaveBeenCalled();
    const op = mcpOperationFixture({
      input: {
        request: input,
        preview: prepared.preview,
        authority: publicationAuthority(ctx),
      },
      approvalHash: fingerprint("proof"),
    });
    m.find.mockResolvedValue(op);
    m.consume.mockResolvedValue({ ...op, status: "approved" });
    const result = await approveMcpPublication(ctx, op.id, "proof");
    expect(result.result?.cancelled).toBe(true);
    expect(m.cancel).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: mcpIds.post,
        expectedVersion: 2,
        mcpOperationId: op.id,
      }),
    );
    expect(m.publish).not.toHaveBeenCalled();
    expect(m.schedule).not.toHaveBeenCalled();
  });
});
