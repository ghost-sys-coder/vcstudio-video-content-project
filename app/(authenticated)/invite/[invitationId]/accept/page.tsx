import { findWorkspaceInvitationForAcceptance } from "@/db/repositories/workspaces.repository";
import { InvitationAcceptCard } from "@/components/invite/InvitationAcceptCard";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { resolveInvitationAcceptanceState } from "@/lib/workspace/invitation-acceptance-state";

export default async function InvitationAcceptPage({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  const { invitationId } = await params;
  const user = await requireAuthenticatedUser();
  const invitation = await findWorkspaceInvitationForAcceptance(invitationId);
  const state = resolveInvitationAcceptanceState({
    invitation,
    userEmail: user.email,
  });

  return (
    <InvitationAcceptCard
      invitationId={invitationId}
      signedInEmail={user.email}
      state={state}
    />
  );
}
