"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { revokeWorkspaceInvitationAction } from "@/app/(authenticated)/app/settings/workspace/actions";
import { Button } from "@/components/ui/button";
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function revoke() {
    if (!window.confirm(`Revoke the invitation sent to ${invitation.email}?`))
      return;
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
        {error ? (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <Button
        className="shrink-0"
        disabled={pending}
        onClick={revoke}
        size="sm"
        type="button"
        variant="ghost"
      >
        Revoke
      </Button>
    </li>
  );
}
