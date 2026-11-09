import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({
  context: vi.fn(),
  preview: vi.fn(),
  remove: vi.fn(),
  audit: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/auth/workspace-context", () => ({
  getAuthenticatedWorkspaceContext: m.context,
}));
vi.mock("@/db/repositories/post-deletion.repository", () => ({
  getPostDeletionPreview: m.preview,
  deleteSocialPostWithMedia: m.remove,
}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: m.audit,
}));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import {
  deleteSocialPostAction,
  getPostDeletionPreviewAction,
} from "@/app/(authenticated)/app/social/posts/actions";
const workspace = "11111111-1111-4111-8111-111111111111",
  postId = "22222222-2222-4222-8222-222222222222",
  assetId = "33333333-3333-4333-8333-333333333333";
function form() {
  const value = new FormData();
  value.set("postId", postId);
  value.set("expectedVersion", "3");
  return value;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.context.mockResolvedValue({
    activeMembership: { workspaceId: workspace, role: "owner" },
    user: { id: "owner-id" },
  });
  m.preview.mockResolvedValue({
    postId,
    name: "Post",
    version: 3,
    status: "draft",
    mediaCount: 1,
    removableMediaCount: 1,
    canDelete: true,
  });
  m.remove.mockResolvedValue({
    deleted: true,
    status: "draft",
    removedMediaIds: [],
  });
});
describe("authorized post deletion actions", () => {
  it.each(["owner", "editor"])(
    "allows %s to inspect saved details and delete using server-resolved workspace",
    async (role) => {
      m.context.mockResolvedValue({
        activeMembership: { workspaceId: workspace, role },
        user: { id: "actor" },
      });
      expect(await getPostDeletionPreviewAction(postId)).toMatchObject({
        ok: true,
        preview: { version: 3 },
      });
      expect(m.preview).toHaveBeenCalledExactlyOnceWith({
        workspaceId: workspace,
        postId,
      });
      const data = form();
      data.set("workspaceId", "injected");
      expect(await deleteSocialPostAction(data)).toEqual({
        ok: true,
        removedMediaCount: 0,
      });
      expect(m.remove).toHaveBeenCalledExactlyOnceWith({
        workspaceId: workspace,
        postId,
        expectedVersion: 3,
        deleteMedia: false,
      });
      expect(m.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: workspace,
          actorUserId: "actor",
          action: "social_post_deleted",
          targetId: postId,
        }),
      );
      expect(m.revalidate).toHaveBeenCalledWith("/app/social/calendar");
      expect(m.revalidate).toHaveBeenCalledWith("/app/social/library");
    },
  );
  it("requires explicit media selection and records exactly which library files were removed", async () => {
    const data = form();
    data.set("deleteMedia", "true");
    m.remove.mockResolvedValue({
      deleted: true,
      status: "scheduled",
      removedMediaIds: [assetId],
    });
    expect(await deleteSocialPostAction(data)).toEqual({
      ok: true,
      removedMediaCount: 1,
    });
    expect(m.remove).toHaveBeenCalledWith(
      expect.objectContaining({ deleteMedia: true }),
    );
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          status: "scheduled",
          deleteMediaRequested: true,
          removedMediaCount: 1,
          removedMediaId1: assetId,
        },
      }),
    );
  });
  it.each(["viewer", null])(
    "rejects %s before reading or mutating posts",
    async (role) => {
      m.context.mockResolvedValue(
        role
          ? {
              activeMembership: { workspaceId: workspace, role },
              user: { id: "viewer" },
            }
          : null,
      );
      expect(await getPostDeletionPreviewAction(postId)).toMatchObject({
        ok: false,
      });
      expect(await deleteSocialPostAction(form())).toMatchObject({ ok: false });
      expect(m.preview).not.toHaveBeenCalled();
      expect(m.remove).not.toHaveBeenCalled();
      expect(m.audit).not.toHaveBeenCalled();
    },
  );
  it("validates post ID and expected version before authentication or queries", async () => {
    expect(await getPostDeletionPreviewAction("tampered")).toMatchObject({
      ok: false,
    });
    const data = form();
    data.delete("expectedVersion");
    expect(await deleteSocialPostAction(data)).toMatchObject({ ok: false });
    data.set("expectedVersion", "3");
    data.set("postId", "bad");
    expect(await deleteSocialPostAction(data)).toMatchObject({ ok: false });
    expect(m.context).not.toHaveBeenCalled();
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("returns safe conflict/missing/failure states without a success audit", async () => {
    m.remove.mockResolvedValue({ deleted: false });
    m.preview.mockResolvedValue(null);
    expect(await getPostDeletionPreviewAction(postId)).toMatchObject({
      ok: false,
      error: expect.stringContaining("no longer available"),
    });
    expect(await deleteSocialPostAction(form())).toMatchObject({
      ok: false,
      error: expect.stringContaining("Reload"),
    });
    expect(m.audit).not.toHaveBeenCalled();
    m.remove.mockRejectedValue(new Error("secret internal details"));
    expect(await deleteSocialPostAction(form())).toEqual({
      ok: false,
      error: "That post could not be removed.",
    });
    m.preview.mockRejectedValue(new Error("secret internal details"));
    expect(await getPostDeletionPreviewAction(postId)).toEqual({
      ok: false,
      error: "The deletion details could not be loaded. Try again.",
    });
  });
});
