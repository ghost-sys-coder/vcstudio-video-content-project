import { Skeleton } from "@/components/ui/skeleton";

/**
 * What a page shows while its server components are still loading.
 *
 * Deliberately a rough shape of the page rather than a spinner. A spinner says
 * "something is happening"; a shape says "content is arriving here, and there
 * will be about this much of it", which is what stops the layout jumping when
 * it lands.
 *
 * `rowCount` exists because these pages differ mostly in how many stacked
 * panels they have, not in their structure.
 */
export function PageSkeleton({
  rowCount = 3,
  showToolbar = false,
}: {
  rowCount?: number;
  showToolbar?: boolean;
}) {
  return (
    <div
      aria-busy="true"
      // Announced once, politely. Screen readers get a single "Loading" rather
      // than a description of every grey box.
      aria-label="Loading"
      className="min-w-0 max-w-full space-y-5"
      role="status"
    >
      {showToolbar ? (
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      ) : null}

      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>

      {Array.from({ length: rowCount }, (_, index) => (
        <div className="rounded-2xl border bg-background p-6" key={index}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-4 w-full max-w-lg" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading this page.</span>
    </div>
  );
}
