"use client";

import { UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { inviteWorkspaceMemberAction } from "@/app/(authenticated)/app/settings/workspace/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkspaceRole } from "@/db/schema";

const ROLE_OPTIONS: { value: WorkspaceRole; label: string }[] = [
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
  { value: "owner", label: "Owner" },
];

export function InviteMemberDialog({ workspaceId }: { workspaceId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<WorkspaceRole>("editor");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await inviteWorkspaceMemberAction(formData);
      if (!result.success) {
        setError(result.error ?? "The invitation could not be sent.");
        return;
      }
      setOpen(false);
      setRole("editor");
      router.refresh();
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button size="sm" />}>
        <UserPlusIcon />
        Invite member
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a teammate</DialogTitle>
          <DialogDescription>
            Clerk emails an invitation link. They&apos;ll join this workspace
            with the role you choose here.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <input name="workspaceId" type="hidden" value={workspaceId} />
          <input name="role" type="hidden" value={role} />
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              disabled={pending}
              id="invite-email"
              name="email"
              placeholder="teammate@example.com"
              required
              type="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role-select">Role</Label>
            <Select
              onValueChange={(value) => setRole(value as WorkspaceRole)}
              value={role}
            >
              <SelectTrigger id="invite-role-select">
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
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button className="w-full" disabled={pending} type="submit">
            {pending ? "Sending invitation…" : "Send invitation"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
