import Link from "next/link";
import { CalendarClockIcon, TvIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductionBlockerList } from "@/components/production/ProductionBlockerList";
import { ProductionReleaseBadge } from "@/components/production/ProductionReleaseBadge";
import { ProductionReviewList } from "@/components/production/ProductionReviewList";
import { ProductionStageBadge } from "@/components/production/ProductionStageBadge";
import type { ProductionQueueItem } from "@/db/repositories/production-queue.repository";
import { formatPlannedRelease } from "@/lib/production/production-queue-view";

/**
 * One project in the queue: where it has genuinely reached, what is holding it
 * up, and the single next thing to do about it.
 */
export function ProductionQueueRow({ item }: { item: ProductionQueueItem }) {
  const { readiness } = item;
  const nothingOutstanding =
    readiness.blockers.length === 0 && readiness.reviews.length === 0;

  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="truncate font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              href={`/app/projects/${item.projectId}`}
            >
              {item.name}
            </Link>
            <ProductionStageBadge stage={readiness.stage} />
            <ProductionReleaseBadge state={readiness.releaseState} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <TvIcon aria-hidden className="size-3.5" />
              {item.channelName ?? "No channel"}
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClockIcon aria-hidden className="size-3.5" />
              {formatPlannedRelease(item.plannedReleaseAt)}
            </span>
          </div>
        </div>
        {readiness.nextAction ? (
          <Button
            nativeButton={false}
            render={
              <Link
                href={`/app/projects/${item.projectId}/${readiness.nextAction.href}`}
              />
            }
            size="sm"
            variant="outline"
          >
            {readiness.nextAction.label}
          </Button>
        ) : null}
      </div>

      {nothingOutstanding ? null : (
        <div className="mt-3 space-y-1 border-t pt-3">
          <ProductionBlockerList
            blockers={readiness.blockers}
            projectId={item.projectId}
          />
          <ProductionReviewList
            projectId={item.projectId}
            reviews={readiness.reviews}
          />
        </div>
      )}
    </li>
  );
}
