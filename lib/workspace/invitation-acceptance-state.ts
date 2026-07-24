import type { WorkspaceRole } from "@/db/schema";
import type { WorkspaceInvitationAcceptanceView } from "@/db/repositories/workspaces.repository";

export type InvitationAcceptanceState =
  | { status: "valid"; workspaceName: string; role: WorkspaceRole }
  | { status: "not_found" }
  | { status: "already_handled" }
  | { status: "expired" }
  | { status: "email_mismatch"; invitedEmail: string };

export function resolveInvitationAcceptanceState(input: {
  invitation: WorkspaceInvitationAcceptanceView | null;
  userEmail: string;
  now?: Date;
}): InvitationAcceptanceState {
  const { invitation } = input;
  if (!invitation) return { status: "not_found" };
  if (invitation.status !== "pending") return { status: "already_handled" };
  if (invitation.expiresAt < (input.now ?? new Date()))
    return { status: "expired" };
  if (invitation.email.toLowerCase() !== input.userEmail.toLowerCase())
    return { status: "email_mismatch", invitedEmail: invitation.email };
  return {
    status: "valid",
    workspaceName: invitation.workspaceName,
    role: invitation.role,
  };
}
