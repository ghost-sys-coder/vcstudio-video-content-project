"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { revokeWorkspaceInvitationAction } from "@/app/(authenticated)/app/settings/workspace/actions";
import { RevokeInvitationDialog } from "@/components/workspace/RevokeInvitationDialog";
import type { WorkspaceInvitationView } from "@/db/repositories/workspaces.repository";
import { formatShortDate } from "@/lib/format/date";

export function PendingInvitationRow({
  invitation,
  workspaceId,
}: {
  invitation: WorkspaceInvitationView;
  workspaceId: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openConfirm(open: boolean) {
    // Clearing on open means a previous failure never greets the next attempt.
    if (open) setError(null);
    setConfirmOpen(open);
  }

  function revoke() {
    setError(null);
    const formData = new FormData();
    formData.set("workspaceId", workspaceId);
    formData.set("invitationId", invitation.id);
    startTransition(async () => {
      const result = await revokeWorkspaceInvitationAction(formData);
      if (!result.success) {
        setError(result.error ?? "The invitation could not be revoked.");
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{invitation.email}</p>
        <p className="truncate text-xs text-muted-foreground capitalize">
          {invitation.role} · invited by {invitation.invitedByDisplayName} ·
          expires {formatShortDate(invitation.expiresAt)}
        </p>
      </div>
      <RevokeInvitationDialog
        email={invitation.email}
        error={error}
        onConfirm={revoke}
        onOpenChange={openConfirm}
        open={confirmOpen}
        pending={pending}
        role={invitation.role}
      />
    </li>
  );
}
