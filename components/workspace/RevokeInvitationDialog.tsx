"use client";

import { Loader2Icon, MailXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Confirms revoking a pending workspace invitation.
 *
 * Controlled by the caller rather than self-managing `open`, so a failed revoke
 * keeps the dialog open and reports the error where the user acted instead of
 * closing over a silent failure.
 */
export function RevokeInvitationDialog({
  email,
  error,
  onConfirm,
  onOpenChange,
  open,
  pending,
  role,
}: {
  email: string;
  error: string | null;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  role: string;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogTrigger
        render={<Button className="shrink-0" size="sm" variant="ghost" />}
        aria-label={`Revoke the invitation sent to ${email}`}
        disabled={pending}
      >
        Revoke
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive"
          >
            <MailXIcon className="size-4.5" />
          </span>
          <DialogTitle>Revoke this invitation?</DialogTitle>
          <DialogDescription>
            The invitation link stops working immediately, so nobody holding it
            can join. You can always send a fresh invitation later.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
          <p className="truncate text-sm font-medium">{email}</p>
          <p className="text-xs text-muted-foreground capitalize">
            Invited as {role}
          </p>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose disabled={pending} render={<Button variant="outline" />}>
            Keep invitation
          </DialogClose>
          <Button
            disabled={pending}
            onClick={onConfirm}
            type="button"
            variant="destructive"
          >
            {pending ? (
              <>
                <Loader2Icon aria-hidden className="animate-spin" />
                Revoking…
              </>
            ) : (
              "Revoke invitation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
