import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AccessDeniedState() {
  return (
    <section className="mx-auto max-w-lg rounded-2xl border bg-background p-8 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-destructive">
        Access denied
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        This workspace is unavailable
      </h1>
      <p className="mt-3 text-muted-foreground">
        Your account is not a verified member of the requested workspace.
      </p>
      <Button
        className="mt-6"
        nativeButton={false}
        render={<Link href="/app" />}
      >
        Return to your workspace
      </Button>
    </section>
  );
}
