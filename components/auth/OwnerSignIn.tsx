import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export function OwnerSignIn() {
  return (
    <div className="app-section">
      <header className="app-heading">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Private development
        </p>
        <h1 className="text-2xl font-semibold">Owner sign in</h1>
        <p className="text-sm text-muted-foreground">
          VCStudio is being built in private. Existing owner accounts can sign
          in here.{" "}
          <Link className="underline underline-offset-4" href="/waitlist">
            Join the waitlist
          </Link>{" "}
          for early access updates.
        </p>
      </header>
      <SignIn signUpUrl="/waitlist" />
    </div>
  );
}
