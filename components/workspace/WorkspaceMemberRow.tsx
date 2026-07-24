"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  removeWorkspaceMemberAction,
  updateWorkspaceMemberRoleAction,
} from "@/app/(authenticated)/app/settings/workspace/actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkspaceMemberView } from "@/db/repositories/workspaces.repository";
import type { WorkspaceRole } from "@/db/schema";

const ROLE_OPTIONS: { value: WorkspaceRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

export function WorkspaceMemberRow({
  member,
  workspaceId,
  isSelf,
  isSoleOwner,
}: {
  member: WorkspaceMemberView;
  workspaceId: string;
  isSelf: boolean;
  isSoleOwner: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const locked = member.role === "owner" && isSoleOwner;

  function changeRole(role: WorkspaceRole) {
    setError(null);
    const formData = new FormData();
    formData.set("workspaceId", workspaceId);
    formData.set("membershipId", member.membershipId);
    formData.set("role", role);
    startTransition(async () => {
      const result = await updateWorkspaceMemberRoleAction(formData);
      if (!result.success) {
        setError(result.error ?? "The role could not be changed.");
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    if (
      !window.confirm(
        `Remove ${member.displayName} from this workspace? They will lose access immediately.`,
      )
    )
      return;
    setError(null);
    const formData = new FormData();
    formData.set("workspaceId", workspaceId);
    formData.set("membershipId", member.membershipId);
    startTransition(async () => {
      const result = await removeWorkspaceMemberAction(formData);
      if (!result.success) {
        setError(result.error ?? "The member could not be removed.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {member.displayName}
          {isSelf ? (
            <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>
          ) : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        {error ? (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Select
          disabled={pending || locked}
          onValueChange={(value) => changeRole(value as WorkspaceRole)}
          value={member.role}
        >
          <SelectTrigger
            aria-label={`Role for ${member.displayName}`}
            className="w-28"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          disabled={pending || locked}
          onClick={remove}
          size="sm"
          type="button"
          variant="ghost"
        >
          Remove
        </Button>
      </div>
    </li>
  );
}
