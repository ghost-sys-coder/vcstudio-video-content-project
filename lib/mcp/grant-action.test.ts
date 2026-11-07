import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  membership: vi.fn(),
  save: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/require-authenticated-user", () => ({
  requireAuthenticatedUser: async () => ({
    id: "22222222-2222-4222-8222-222222222222",
  }),
}));
vi.mock("@/lib/auth/workspace-context", () => ({
  requireWorkspaceMembership: mock.membership,
}));
vi.mock("@/db/repositories/mcp.repository", () => ({
  saveMcpGrant: mock.save,
  revokeMcpConnection: vi.fn(),
  listMcpGrants: vi.fn(),
  findMcpConnection: vi.fn(),
}));
vi.mock("@/lib/audit/record-audit-event", () => ({
  recordAuditEvent: mock.audit,
}));
vi.mock("./context", () => ({ requireMcpEnabled: vi.fn() }));
import { saveMcpGrantAction } from "@/app/(authenticated)/app/settings/mcp/actions";
import { mcpIds } from "@/lib/test-utils/mcp-fixtures";
function form(mode = "manual", publish = true) {
  const data = new FormData();
  data.set("connectionId", mcpIds.connection);
  data.set("workspaceId", mcpIds.workspace);
  data.append("scopes", "vcstudio:read");
  if (publish) data.append("scopes", "vcstudio:publish");
  data.set("publicationApprovalMode", mode);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.membership.mockResolvedValue({ role: "owner" });
});
describe("signed-in autonomy grant settings", () => {
  it("saves explicit owner autonomy and audits its basis", async () => {
    expect(
      (await saveMcpGrantAction({ ok: false, message: "" }, form("autonomous")))
        .ok,
    ).toBe(true);
    expect(mock.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mcpIds.user,
        publicationApprovalMode: "autonomous",
      }),
    );
    expect(mock.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          publicationApprovalMode: "autonomous",
        }),
      }),
    );
  });
  it.each(["editor", "viewer"])(
    "does not let a %s enable autonomy",
    async (role) => {
      mock.membership.mockResolvedValue({ role });
      expect(
        (
          await saveMcpGrantAction(
            { ok: false, message: "" },
            form("autonomous"),
          )
        ).ok,
      ).toBe(false);
      expect(mock.save).not.toHaveBeenCalled();
    },
  );
  it("requires Publish permission and rejects unknown modes", async () => {
    for (const data of [form("autonomous", false), form("anything")])
      expect(
        (await saveMcpGrantAction({ ok: false, message: "" }, data)).ok,
      ).toBe(false);
    expect(mock.save).not.toHaveBeenCalled();
  });
  it("keeps existing grant forms manual when they omit the new setting", async () => {
    const data = form();
    data.delete("publicationApprovalMode");
    expect(
      (await saveMcpGrantAction({ ok: false, message: "" }, data)).ok,
    ).toBe(true);
    expect(mock.save).toHaveBeenCalledWith(
      expect.objectContaining({ publicationApprovalMode: "manual" }),
    );
  });
});
