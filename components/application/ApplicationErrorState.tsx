"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Safe error boundary fallback. Shows an actionable, non-technical message and a
 * retry control; it never renders provider errors, stack traces, or internal
 * detail. The underlying exception is reported to the server logs by Next.js.
 */
export function ApplicationErrorState({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [isRetrying, startRetry] = useTransition();
  const [hasRetried, setHasRetried] = useState(false);
  const statusId = useId();

  return (
    <div className="app-panel mx-auto flex min-h-[50dvh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangleIcon aria-hidden />
      </span>
      <div className="app-heading">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          This view could not be loaded. You can try again, or return to the
          dashboard if the problem continues.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button
          aria-busy={isRetrying}
          aria-describedby={statusId}
          disabled={isRetrying}
          onClick={() => {
            if (isRetrying) return;
            setHasRetried(true);
            startRetry(() => {
              router.refresh();
              reset();
            });
          }}
          type="button"
        >
          {isRetrying && <Spinner aria-hidden />}
          {isRetrying ? "Trying again…" : "Try again"}
        </Button>
        <Link
          href="/app"
          prefetch={false}
          className={buttonVariants({ variant: "outline" })}
        >
          Go to dashboard
        </Link>
      </div>
      <p id={statusId} role="status" className="text-sm text-muted-foreground">
        {isRetrying
          ? "Reloading this view…"
          : hasRetried
            ? "This view is still unavailable. You can try again or return to the dashboard."
            : ""}
      </p>
    </div>
  );
}
