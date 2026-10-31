"use client";

import { useRef, useState, useTransition } from "react";
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

export type DisconnectChannelResult = {
  success: boolean;
  error: string | null;
};

export function DisconnectChannelDialog({
  accountName,
  connectionId,
  disabled = false,
  onDisconnect,
  platformLabel,
}: {
  accountName: string;
  connectionId: string;
  disabled?: boolean;
  onDisconnect: (connectionId: string) => Promise<DisconnectChannelResult>;
  platformLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const cancelButton = useRef<HTMLButtonElement>(null);

  function confirmDisconnect() {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await onDisconnect(connectionId);
        if (result.success) setOpen(false);
        else setError(result.error ?? "The channel could not be disconnected.");
      } catch {
        setError("The channel could not be disconnected. Please try again.");
      } finally {
        inFlight.current = false;
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen, details) => {
        if (inFlight.current) {
          details.cancel();
          return;
        }
        setError(null);
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger
        disabled={disabled || pending}
        render={<Button size="sm" type="button" variant="outline" />}
      >
        Disconnect
      </DialogTrigger>
      <DialogContent initialFocus={cancelButton} showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle className="min-w-0 [overflow-wrap:anywhere]">
            Disconnect {accountName}?
          </DialogTitle>
          <DialogDescription>
            This removes this workspace&apos;s saved credentials for this{" "}
            {platformLabel} account. Reconnect before publishing to it again.
            Existing posts and publication history are kept.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Scheduled posts that still need this connection may fail until you
          reconnect.
        </p>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <DialogClose
            disabled={pending}
            render={
              <Button ref={cancelButton} type="button" variant="outline" />
            }
          >
            Cancel
          </DialogClose>
          <Button
            aria-busy={pending}
            disabled={disabled || pending}
            onClick={confirmDisconnect}
            type="button"
            variant="destructive"
          >
            {pending ? "Disconnecting..." : "Disconnect account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
