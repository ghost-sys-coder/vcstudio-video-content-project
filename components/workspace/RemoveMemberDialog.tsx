"use client";

import { Loader2Icon, UserMinusIcon } from "lucide-react";
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
 * Confirms removing a member from the workspace.
 *
 * Controlled by the caller rather than self-managing `open`, so a failed removal
 * keeps the dialog open and reports the error where the user acted instead of
 * closing over a silent failure.
 */
export function RemoveMemberDialog({
  disabled,
  displayName,
  email,
  error,
  onConfirm,
  onOpenChange,
  open,
  pending,
  role,
}: {
  disabled: boolean;
  displayName: string;
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
        render={<Button size="sm" variant="ghost" />}
        aria-label={`Remove ${displayName} from this workspace`}
        disabled={disabled}
      >
        Remove
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-full bg-destructive/10 text-destructive"
          >
            <UserMinusIcon className="size-4.5" />
          </span>
          <DialogTitle>Remove {displayName}?</DialogTitle>
          <DialogDescription>
            They lose access to this workspace immediately. Everything they
            created — projects, renders, and posts — stays with the workspace.
            You can invite them back, but they will need to accept a new
            invitation.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/40 px-3 py-2.5">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {email} · <span className="capitalize">{role}</span>
          </p>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose disabled={pending} render={<Button variant="outline" />}>
            Keep member
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
                Removing…
              </>
            ) : (
              "Remove member"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
