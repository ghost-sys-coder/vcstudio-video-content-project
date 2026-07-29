import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shared 404 view for both `app/not-found.tsx` (unmatched URLs, rendered
 * outside any authenticated shell) and `app/(authenticated)/app/not-found.tsx`
 * (a `notFound()` call from within the app, e.g. a deleted or foreign project
 * — rendered inside `ApplicationShell`, so the sidebar stays put). The home
 * destination differs by context, so it's a prop rather than two components.
 */
export function NotFoundState({
  homeHref = "/",
  homeLabel = "Go home",
}: {
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CompassIcon aria-hidden />
      </span>
      <div className="space-y-1">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="text-sm text-muted-foreground">
          This page doesn&apos;t exist, or whatever it pointed to may have been
          moved, renamed, or deleted.
        </p>
      </div>
      <Button nativeButton={false} render={<Link href={homeHref} />}>
        {homeLabel}
      </Button>
    </div>
  );
}
