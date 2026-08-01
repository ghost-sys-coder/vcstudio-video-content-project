"use client";

import { useClerk } from "@clerk/nextjs";
import { Loader2Icon, LogOut } from "lucide-react";
import { useTransition } from "react";
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
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { signOutAndLeave } from "@/lib/auth/sign-out-and-leave";

/**
 * The sidebar's account row, gated behind a confirmation before it signs the
 * user out. A single misclick on a full-width sidebar row was previously
 * enough to end the session with no way back.
 */
export function LogoutConfirmDialog({
  initials,
  userDisplayName,
}: {
  initials: string;
  userDisplayName: string;
}) {
  const { signOut } = useClerk();
  const [pending, startTransition] = useTransition();

  function confirmLogout() {
    startTransition(async () => {
      await signOutAndLeave({ destination: "/", signOut });
    });
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <SidebarMenuButton size="lg" tooltip={`Log out ${userDisplayName}`} />
        }
      >
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground"
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block truncate font-medium">{userDisplayName}</span>
          <span className="block truncate text-xs text-muted-foreground">
            Log out
          </span>
        </span>
        <LogOut className="ml-auto text-muted-foreground" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log out?</DialogTitle>
          <DialogDescription>
            You&apos;ll need to sign back in as {userDisplayName} to get back to
            this workspace.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={pending}
            onClick={confirmLogout}
            type="button"
            variant="destructive"
          >
            {pending ? (
              <>
                <Loader2Icon aria-hidden className="animate-spin" />
                Logging out…
              </>
            ) : (
              "Log out"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
