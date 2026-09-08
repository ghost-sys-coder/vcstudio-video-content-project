import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  project: vi.fn(),
  draft: vi.fn(),
  save: vi.fn(),
  approve: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/auth/workspace-context", () => ({
  getAuthenticatedWorkspaceContext: mocks.context,
}));
vi.mock("@/db/repositories/projects.repository", () => ({
  findProject: mocks.project,
  findProjectScriptDraft: mocks.draft,
}));
vi.mock("@/db/commands/script-commands", () => ({
  saveScriptDraft: mocks.save,
}));
vi.mock("@/db/commands/commit-script-version", () => ({
  commitScriptVersion: mocks.approve,
}));
vi.mock("@/lib/env/server", () => ({
  getProjectEnvironment: () => ({ MAX_SCRIPT_CHARACTERS: 1000 }),
}));
import { persistScriptDraftAction } from "@/app/(authenticated)/app/projects/[projectId]/script/actions";
const projectId = "00000000-0000-4000-8000-000000000001";
const request = { projectId, content: "Script", revision: 3, approve: false };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue({
    user: { id: "server-user" },
    activeMembership: { role: "editor", workspaceId: "server-workspace" },
  });
  mocks.project.mockResolvedValue({ id: projectId, status: "draft" });
  mocks.save.mockResolvedValue({ content: "Script", revision: 4 });
  mocks.approve.mockResolvedValue({ id: "version", revision: 4 });
});
describe("script draft action authorization", () => {
  it("uses the server identity and workspace instead of browser-supplied ownership", async () => {
    expect(
      (
        await persistScriptDraftAction({
          ...request,
          workspaceId: "attacker",
          userId: "attacker",
        })
      ).status,
    ).toBe("saved");
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "server-workspace",
        userId: "server-user",
      }),
    );
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it.each([false, true])(
    "rejects viewer mutation with approve=%s",
    async (approve) => {
      mocks.context.mockResolvedValue({
        user: { id: "viewer" },
        activeMembership: { role: "viewer", workspaceId: "server-workspace" },
      });
      expect(
        (await persistScriptDraftAction({ ...request, approve })).status,
      ).toBe("error");
      expect(mocks.save).not.toHaveBeenCalled();
      expect(mocks.approve).not.toHaveBeenCalled();
    },
  );
  it("does not write missing or archived projects", async () => {
    mocks.project
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ status: "archived" });
    expect((await persistScriptDraftAction(request)).status).toBe("error");
    expect((await persistScriptDraftAction(request)).status).toBe("error");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("returns scoped current text for explicit conflict resolution", async () => {
    mocks.save.mockRejectedValue(new Error("SCRIPT_REVISION_CONFLICT"));
    mocks.draft.mockResolvedValue({ content: "Latest", revision: 8 });
    expect(await persistScriptDraftAction(request)).toEqual({
      status: "conflict",
      draft: { content: "Latest", revision: 8 },
    });
    expect(mocks.draft).toHaveBeenCalledWith({
      workspaceId: "server-workspace",
      projectId,
    });
  });
  it("validates limits and approves through one atomic command", async () => {
    expect(
      (
        await persistScriptDraftAction({
          ...request,
          content: "x".repeat(1001),
        })
      ).status,
    ).toBe("error");
    expect(
      (
        await persistScriptDraftAction({
          ...request,
          content: " ",
          approve: true,
        })
      ).status,
    ).toBe("error");
    expect(
      (await persistScriptDraftAction({ ...request, approve: true })).status,
    ).toBe("saved");
    expect(mocks.approve).toHaveBeenCalledOnce();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
