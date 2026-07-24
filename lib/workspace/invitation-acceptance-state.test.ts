import { describe, expect, it } from "vitest";
import { resolveInvitationAcceptanceState } from "@/lib/workspace/invitation-acceptance-state";
import type { WorkspaceInvitationAcceptanceView } from "@/db/repositories/workspaces.repository";

const now = new Date("2026-07-24T12:00:00Z");

const baseInvitation: WorkspaceInvitationAcceptanceView = {
  id: "invitation-id",
  email: "teammate@example.com",
  role: "editor",
  status: "pending",
  expiresAt: new Date("2026-08-24T12:00:00Z"),
  workspaceId: "workspace-id",
  workspaceName: "Studio North",
};

describe("resolveInvitationAcceptanceState", () => {
  it("resolves valid when pending, unexpired, and emails match", () => {
    expect(
      resolveInvitationAcceptanceState({
        invitation: baseInvitation,
        userEmail: "Teammate@Example.com",
        now,
      }),
    ).toEqual({
      status: "valid",
      workspaceName: "Studio North",
      role: "editor",
    });
  });

  it("resolves not_found when no invitation exists", () => {
    expect(
      resolveInvitationAcceptanceState({
        invitation: null,
        userEmail: "teammate@example.com",
        now,
      }),
    ).toEqual({ status: "not_found" });
  });

  it("resolves already_handled for a non-pending invitation", () => {
    expect(
      resolveInvitationAcceptanceState({
        invitation: { ...baseInvitation, status: "accepted" },
        userEmail: "teammate@example.com",
        now,
      }),
    ).toEqual({ status: "already_handled" });
  });

  it("resolves expired when past expiresAt, even if still pending", () => {
    expect(
      resolveInvitationAcceptanceState({
        invitation: {
          ...baseInvitation,
          expiresAt: new Date("2026-07-01T00:00:00Z"),
        },
        userEmail: "teammate@example.com",
        now,
      }),
    ).toEqual({ status: "expired" });
  });

  it("resolves email_mismatch when the signed-in user's email differs", () => {
    expect(
      resolveInvitationAcceptanceState({
        invitation: baseInvitation,
        userEmail: "someone-else@example.com",
        now,
      }),
    ).toEqual({
      status: "email_mismatch",
      invitedEmail: "teammate@example.com",
    });
  });
});
