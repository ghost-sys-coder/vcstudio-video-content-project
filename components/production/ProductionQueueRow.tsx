import Link from "next/link";
import { ArrowRight, CalendarClock, Tv } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { ProductionBlockerList } from "./ProductionBlockerList";
import { ProductionReleaseBadge } from "./ProductionReleaseBadge";
import { ProductionReviewList } from "./ProductionReviewList";
import { ProductionStageBadge } from "./ProductionStageBadge";
import type { ProductionQueueItem } from "@/db/repositories/production-queue.repository";
import { formatPlannedRelease } from "@/lib/production/production-queue-view";

export function ProductionQueueRow({ item }: { item: ProductionQueueItem }) {
  const { readiness } = item;
  const hasOutstanding =
    readiness.blockers.length > 0 || readiness.reviews.length > 0;
  return (
    <li className="min-w-0">
      <Card className="min-w-0 shadow-sm">
        <CardHeader>
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-3">
              <h3 className="text-lg font-semibold leading-snug tracking-tight [overflow-wrap:anywhere]">
                <Link
                  href={`/app/projects/${item.projectId}`}
                  prefetch={false}
                  className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
                >
                  {item.name}
                </Link>
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <ProductionStageBadge stage={readiness.stage} />
                <ProductionReleaseBadge state={readiness.releaseState} />
              </div>
            </div>
            {readiness.nextAction && (
              <Link
                href={`/app/projects/${item.projectId}/${readiness.nextAction.href}`}
                prefetch={false}
                className={buttonVariants({
                  variant: "outline",
                  className: "w-full sm:w-auto",
                })}
              >
                {readiness.nextAction.label}
                <ArrowRight aria-hidden="true" />
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Tv aria-hidden="true" className="size-3.5 shrink-0" />
                Channel
              </dt>
              <dd className="text-sm [overflow-wrap:anywhere]">
                {item.channelName ?? "No channel"}
              </dd>
            </div>
            <div className="space-y-1.5">
              <dt className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <CalendarClock
                  aria-hidden="true"
                  className="size-3.5 shrink-0"
                />
                Planned release (UTC)
              </dt>
              <dd className="text-sm tabular-nums">
                {formatPlannedRelease(item.plannedReleaseAt)}
              </dd>
            </div>
          </dl>
        </CardContent>
        {hasOutstanding && (
          <CardFooter className="flex-col items-stretch gap-3 bg-muted/25">
            <h4 className="text-xs font-semibold text-muted-foreground">
              Needs attention
            </h4>
            <ProductionBlockerList
              blockers={readiness.blockers}
              projectId={item.projectId}
            />
            <ProductionReviewList
              projectId={item.projectId}
              reviews={readiness.reviews}
            />
          </CardFooter>
        )}
      </Card>
    </li>
  );
}
