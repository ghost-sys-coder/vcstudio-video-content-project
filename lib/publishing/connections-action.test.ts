import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  disconnect: vi.fn(),
  audit: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/auth/workspace-context", () => ({
  getAuthenticatedWorkspaceContext: mocks.context,
}));
vi.mock("@/lib/publishing/disconnect-platform-connection", () => ({
  disconnectPlatformAuthorization: mocks.disconnect,
}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: mocks.audit,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { disconnectWorkspaceChannelAction } from "@/app/(authenticated)/app/settings/workspace/actions";

const connectionId = "11111111-1111-4111-8111-111111111111";
function request() {
  const form = new FormData();
  form.set("connectionId", connectionId);
  form.set("workspaceId", "untrusted-workspace");
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.disconnect.mockResolvedValue({ disconnected: true });
});

describe("shared account disconnect action", () => {
  it("resolves the owner's workspace on the server and refreshes the shared page", async () => {
    mocks.context.mockResolvedValue({
      activeMembership: { workspaceId: "authorized-workspace", role: "owner" },
      user: { id: "actor" },
    });
    await expect(disconnectWorkspaceChannelAction(request())).resolves.toEqual({
      success: true,
      error: null,
    });
    expect(mocks.disconnect).toHaveBeenCalledExactlyOnceWith({
      connectionId,
      workspaceId: "authorized-workspace",
    });
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "actor",
        workspaceId: "authorized-workspace",
        action: "platform_disconnected",
        targetId: connectionId,
      }),
    );
    expect(mocks.revalidate).toHaveBeenCalledWith("/app/social/accounts");
  });

  it.each(["editor", "viewer"] as const)(
    "rejects a crafted disconnect request from %s",
    async (role) => {
      mocks.context.mockResolvedValue({
        activeMembership: { workspaceId: "authorized-workspace", role },
      });
      expect((await disconnectWorkspaceChannelAction(request())).success).toBe(
        false,
      );
      expect(mocks.disconnect).not.toHaveBeenCalled();
      expect(mocks.audit).not.toHaveBeenCalled();
      expect(mocks.revalidate).not.toHaveBeenCalled();
    },
  );

  it("rejects invalid connection identifiers before any workspace or provider work", async () => {
    expect(
      (await disconnectWorkspaceChannelAction(new FormData())).success,
    ).toBe(false);
    expect(mocks.context).not.toHaveBeenCalled();
    expect(mocks.disconnect).not.toHaveBeenCalled();
  });
});
