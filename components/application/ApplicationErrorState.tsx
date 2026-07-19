"use client";

import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Safe error boundary fallback. Shows an actionable, non-technical message and a
 * retry control; it never renders provider errors, stack traces, or internal
 * detail. The underlying exception is reported to the server logs by Next.js.
 */
export function ApplicationErrorState({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangleIcon aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          This view could not be loaded. You can try again, or return to the
          dashboard if the problem continues.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} type="button">
          Try again
        </Button>
        <Button
          onClick={() => {
            window.location.href = "/app";
          }}
          type="button"
          variant="outline"
        >
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
