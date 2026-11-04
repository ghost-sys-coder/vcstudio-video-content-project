"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { revokeMcpConnectionAction } from "@/app/(authenticated)/app/settings/mcp/actions";
export function McpRevokeDialog({ connectionId }: { connectionId: string }) {
  const [state, action, pending] = useActionState(revokeMcpConnectionAction, {
    ok: false,
    message: "",
  });
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        Disconnect AI connection
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disconnect this AI connection?</DialogTitle>
          <DialogDescription>
            New actions and pending approvals will stop. Posts you already
            approved and scheduled remain on the Social calendar.
          </DialogDescription>
        </DialogHeader>
        <form action={action}>
          <input type="hidden" name="connectionId" value={connectionId} />
          <DialogFooter>
            <DialogClose
              render={
                <Button type="button" variant="outline" disabled={pending} />
              }
            >
              Keep connected
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || state.ok}
            >
              {pending ? "Disconnecting…" : "Disconnect"}
            </Button>
          </DialogFooter>
        </form>
        {state.message && (
          <p role={state.ok ? "status" : "alert"}>{state.message}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
