"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangleIcon,
  FolderKanbanIcon,
  RefreshCwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function DashboardUnavailableState({
  supportReference,
}: {
  supportReference: string;
}) {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();

  return (
    <section
      aria-labelledby="dashboard-unavailable-heading"
      className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-4 py-12"
    >
      <div className="w-full overflow-hidden rounded-3xl border bg-card shadow-xl shadow-foreground/5">
        <div className="border-b bg-amber-500/8 px-6 py-7 sm:px-8">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <AlertTriangleIcon aria-hidden className="size-6" />
          </span>
          <p className="mt-5 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Dashboard temporarily unavailable
          </p>
          <h1
            className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl"
            id="dashboard-unavailable-heading"
          >
            We couldn&rsquo;t load your workspace summary
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            The dashboard could not reach part of the data service. No changes
            were made to your workspace, and the rest of the application is
            still available from the navigation.
          </p>
        </div>

        <div className="space-y-5 px-6 py-6 sm:px-8">
          <div className="rounded-2xl bg-muted/55 p-4 text-sm">
            <p className="font-medium">What you can do</p>
            <p className="mt-1 text-muted-foreground">
              Try loading the summary again. If it still fails, continue to
              Projects and share the reference below with support.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              aria-describedby="dashboard-retry-status"
              disabled={isRetrying}
              onClick={() => {
                startTransition(() => router.refresh());
              }}
              type="button"
            >
              <RefreshCwIcon
                aria-hidden
                className={isRetrying ? "animate-spin" : undefined}
              />
              {isRetrying ? "Trying again…" : "Try again"}
            </Button>
            <Button
              nativeButton={false}
              render={<Link href="/app/projects" />}
              variant="outline"
            >
              <FolderKanbanIcon aria-hidden />
              Open projects
            </Button>
          </div>

          <p aria-live="polite" className="sr-only" id="dashboard-retry-status">
            {isRetrying
              ? "Reloading dashboard data."
              : "Dashboard retry ready."}
          </p>
          <p className="border-t pt-4 font-mono text-xs text-muted-foreground">
            Support reference: {supportReference}
          </p>
        </div>
      </div>
    </section>
  );
}
