import { beforeEach, describe, expect, it, vi } from "vitest";
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
  lock: vi.fn(),
  unlock: vi.fn(),
  publish: vi.fn(),
  schedule: vi.fn(),
  cancel: vi.fn(),
  draftDestinations: vi.fn(),
  prepareDestinations: vi.fn(),
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
describe("publication approval boundary", () => {
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
