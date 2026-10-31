import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  list: vi.fn(),
  find: vi.fn(),
  cookie: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookie }),
}));
vi.mock("@/lib/auth/require-authenticated-user", () => ({
  requireAuthenticatedUser: mocks.user,
}));
vi.mock("@/db/repositories/workspaces.repository", () => ({
  listWorkspaceMemberships: mocks.list,
  findWorkspaceMembership: mocks.find,
}));
import {
  getAuthenticatedWorkspaceContext,
  requireWorkspaceMembership,
} from "./workspace-context";
const first = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  workspaceName: "First",
  workspaceSlug: "first",
  role: "owner",
};
const second = {
  ...first,
  workspaceId: "22222222-2222-4222-8222-222222222222",
  workspaceName: "Second",
  role: "viewer",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({ id: "actor" });
  mocks.list.mockResolvedValue([first, second]);
});
describe("workspace context membership reuse", () => {
  it("selects the verified cookie membership without another database lookup", async () => {
    mocks.cookie.mockReturnValue({ value: second.workspaceId });
    expect(
      (await getAuthenticatedWorkspaceContext())?.activeMembership,
    ).toEqual(second);
    expect(mocks.list).toHaveBeenCalledExactlyOnceWith("actor");
    expect(mocks.find).not.toHaveBeenCalled();
  });
  it.each([undefined, "malformed", "33333333-3333-4333-8333-333333333333"])(
    "falls back safely for cookie %s",
    async (value) => {
      mocks.cookie.mockReturnValue(value ? { value } : undefined);
      expect(
        (await getAuthenticatedWorkspaceContext())?.activeMembership,
      ).toEqual(first);
      expect(mocks.find).not.toHaveBeenCalled();
    },
  );
  it("returns no context for a user without memberships", async () => {
    mocks.list.mockResolvedValue([]);
    expect(await getAuthenticatedWorkspaceContext()).toBeNull();
    expect(mocks.cookie).not.toHaveBeenCalled();
  });
  it("still resolves an explicit authorization check against current membership", async () => {
    mocks.find.mockResolvedValue(first);
    await requireWorkspaceMembership({
      userId: "actor",
      workspaceId: first.workspaceId,
    });
    expect(mocks.find).toHaveBeenCalledExactlyOnceWith({
      userId: "actor",
      workspaceId: first.workspaceId,
    });
  });
});
