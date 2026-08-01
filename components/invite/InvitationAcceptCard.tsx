"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { acceptWorkspaceInvitationAction } from "@/app/(authenticated)/invite/[invitationId]/accept/actions";
import { Button } from "@/components/ui/button";
import { signOutAndLeave } from "@/lib/auth/sign-out-and-leave";
import type { InvitationAcceptanceState } from "@/lib/workspace/invitation-acceptance-state";

const INVALID_STATE_COPY: Record<
  Exclude<InvitationAcceptanceState["status"], "valid" | "email_mismatch">,
  string
> = {
  not_found: "This invitation is no longer valid.",
  already_handled: "This invitation has already been used.",
  expired:
    "This invitation has expired. Ask the workspace owner to send a new one.",
};

export function InvitationAcceptCard({
  invitationId,
  signedInEmail,
  state,
}: {
  invitationId: string;
  signedInEmail: string;
  state: InvitationAcceptanceState;
}) {
  const router = useRouter();
  const { signOut } = useClerk();
  const [pending, startTransition] = useTransition();

  function accept() {
    const formData = new FormData();
    formData.set("invitationId", invitationId);
    startTransition(async () => {
      const result = await acceptWorkspaceInvitationAction(formData);
      if (result.error || !result.workspaceId) return;
      router.push("/app");
      router.refresh();
    });
  }

  let content: React.ReactNode;
  if (state.status === "email_mismatch") {
    content = (
      <>
        <h1 className="text-xl font-semibold">Wrong account</h1>
        <p className="text-sm text-muted-foreground">
          This invitation was sent to <strong>{state.invitedEmail}</strong>, but
          you&apos;re signed in as <strong>{signedInEmail}</strong>.
        </p>
        <Button
          className="w-full"
          onClick={() =>
            void signOutAndLeave({
              destination: `/invite/${invitationId}/accept`,
              signOut,
            })
          }
          type="button"
        >
          Sign out and try again
        </Button>
      </>
    );
  } else if (state.status !== "valid") {
    content = (
      <>
        <h1 className="text-xl font-semibold">Invitation unavailable</h1>
        <p className="text-sm text-muted-foreground">
          {INVALID_STATE_COPY[state.status]}
        </p>
        <Link
          className="text-sm font-medium text-primary hover:underline"
          href="/app"
        >
          Go to VCStudio
        </Link>
      </>
    );
  } else {
    content = (
      <>
        <h1 className="text-xl font-semibold">You&apos;re invited</h1>
        <p className="text-sm text-muted-foreground">
          Join <strong>{state.workspaceName}</strong> as{" "}
          <strong className="capitalize">{state.role}</strong>.
        </p>
        <Button
          className="w-full"
          disabled={pending}
          onClick={accept}
          type="button"
        >
          {pending ? "Joining…" : "Accept invitation"}
        </Button>
      </>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-6 py-16">
      <section className="w-full max-w-md space-y-4 rounded-2xl border bg-background p-8 text-center shadow-sm">
        {content}
      </section>
    </main>
  );
}
