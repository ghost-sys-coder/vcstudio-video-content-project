import Link from "next/link";
import { Show, SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { WaitlistForm } from "./WaitlistForm";

export function WaitlistPageContent() {
  return (
    <div className="app-section">
      <header className="app-heading">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          VCStudio early access
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          We&apos;re building something worth waiting for.
        </h1>
        <p className="text-muted-foreground">
          VCStudio is currently in private development. Access is limited while
          we finish building and testing. Join the waitlist to hear when early
          access opens.
        </p>
      </header>
      <WaitlistForm />
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <Link className="underline underline-offset-4" href="/">
          Back to home
        </Link>
        <Show when="signed-out">
          <Link className="underline underline-offset-4" href="/sign-in">
            Owner sign in
          </Link>
        </Show>
        <Show when="signed-in">
          <SignOutButton redirectUrl="/sign-in">
            <Button type="button" variant="outline">
              Switch account
            </Button>
          </SignOutButton>
        </Show>
      </div>
    </div>
  );
}
