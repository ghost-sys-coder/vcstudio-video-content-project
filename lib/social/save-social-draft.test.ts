import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ connections: vi.fn(), save: vi.fn() }));
vi.mock("@/db/repositories/social-post-destinations.repository", () => ({
  findSocialPostDestinationConnections: m.connections,
}));
vi.mock("@/db/commands/social-post-commands", () => ({
  updateSocialPostDraft: m.save,
}));
vi.mock("@/db/repositories/media-assets.repository", () => ({
  findReadyMediaAssets: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/db/repositories/video-render.repository", () => ({
  findPublishableRenders: vi.fn().mockResolvedValue([]),
}));
import { saveAuthorizedSocialDraft } from "./save-social-draft";
import { mcpIds } from "@/lib/test-utils/mcp-fixtures";
const context = { workspaceId: mcpIds.workspace, role: "owner" as const };
const request = {
  postId: mcpIds.post,
  expectedVersion: 2,
  name: "Draft",
  bodyDocument: { type: "doc", content: [] },
  attachments: [],
};
beforeEach(() => {
  vi.clearAllMocks();
  m.connections.mockResolvedValue([
    { id: mcpIds.destination, platform: "linkedin" },
  ]);
  m.save.mockResolvedValue({ outcome: "updated" });
});
describe("shared Social draft destinations", () => {
  it("saves explicit accounts only after workspace ownership validation", async () => {
    await saveAuthorizedSocialDraft(context, {
      ...request,
      connectionIds: [mcpIds.destination],
    });
    expect(m.connections).toHaveBeenCalledWith({
      workspaceId: context.workspaceId,
      connectionIds: [mcpIds.destination],
    });
    expect(m.save).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: context.workspaceId,
        connectionIds: [mcpIds.destination],
      }),
    );
  });
  it("rejects a foreign or missing account before changing the draft", async () => {
    m.connections.mockResolvedValue([]);
    await expect(
      saveAuthorizedSocialDraft(context, {
        ...request,
        connectionIds: [mcpIds.destination],
      }),
    ).rejects.toThrow("destination accounts");
    expect(m.save).not.toHaveBeenCalled();
  });
  it("distinguishes omission from clearing every destination", async () => {
    await saveAuthorizedSocialDraft(context, request);
    expect(m.connections).not.toHaveBeenCalled();
    expect(m.save.mock.calls[0]?.[0].connectionIds).toBeUndefined();
    m.connections.mockResolvedValue([]);
    await saveAuthorizedSocialDraft(context, { ...request, connectionIds: [] });
    expect(m.save.mock.calls[1]?.[0].connectionIds).toEqual([]);
  });
  it("refuses viewers and duplicate IDs without saving", async () => {
    await expect(
      saveAuthorizedSocialDraft(
        { ...context, role: "viewer" },
        { ...request, connectionIds: [mcpIds.destination] },
      ),
    ).rejects.toThrow();
    await expect(
      saveAuthorizedSocialDraft(context, {
        ...request,
        connectionIds: [mcpIds.destination, mcpIds.destination],
      }),
    ).rejects.toThrow();
    expect(m.save).not.toHaveBeenCalled();
  });
});
