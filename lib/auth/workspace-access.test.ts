import { describe, expect, it } from "vitest";
import { WorkspaceAccessDeniedError } from "@/lib/domain/errors";
import { resolveRequiredWorkspaceMembership } from "@/lib/auth/workspace-access";

const workspaceA = {
  workspaceId: "00000000-0000-4000-8000-000000000001",
  workspaceName: "Workspace A",
  workspaceSlug: "workspace-a",
  role: "owner" as const,
};

describe("workspace access resolution", () => {
  it("rejects a nonmember", async () => {
    await expect(
      resolveRequiredWorkspaceMembership({
        userId: "user-b",
        workspaceId: workspaceA.workspaceId,
        lookup: async () => null,
      }),
    ).rejects.toBeInstanceOf(WorkspaceAccessDeniedError);
  });

  it("does not allow a workspace A member to access workspace B", async () => {
    await expect(
      resolveRequiredWorkspaceMembership({
        userId: "user-a",
        workspaceId: "00000000-0000-4000-8000-000000000002",
        lookup: async ({ workspaceId }) =>
          workspaceId === workspaceA.workspaceId ? workspaceA : null,
      }),
    ).rejects.toBeInstanceOf(WorkspaceAccessDeniedError);
  });

  it("returns the verified membership for the requested workspace", async () => {
    await expect(
      resolveRequiredWorkspaceMembership({
        userId: "user-a",
        workspaceId: workspaceA.workspaceId,
        lookup: async () => workspaceA,
      }),
    ).resolves.toEqual(workspaceA);
  });
});
