import { ListChecks } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import type { ProductionQueueItem } from "@/db/repositories/production-queue.repository";
import { summarizeProductionQueue } from "@/lib/production/production-queue-view";

export function ProductionQueueOverview({
  items,
}: {
  items: ProductionQueueItem[];
}) {
  const summary = summarizeProductionQueue(items);
  return (
    <Card
      role="region"
      aria-label="Queue page summary"
      className="min-w-0 bg-secondary/25 shadow-none"
    >
      <CardContent className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/20">
            <ListChecks aria-hidden="true" className="size-5" />
          </div>
          <div className="app-heading">
            <h2 className="text-lg font-semibold tracking-tight">
              This page at a glance
            </h2>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              {summary.shown
                ? "Start with blockers and outstanding reviews, then follow the next step on each project."
                : "There are no projects to summarize on this page. Adjust the view below to continue."}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-4 sm:gap-8 lg:shrink-0">
          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground">Shown</dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {summary.shown}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground">
              Blocked
            </dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {summary.blocked}
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-xs font-medium text-muted-foreground">
              Awaiting review
            </dt>
            <dd className="text-2xl font-semibold tabular-nums">
              {summary.awaitingReview}
            </dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="bg-transparent text-xs leading-relaxed text-muted-foreground">
        Counts reflect the projects shown below. A project can need both fixes
        and review.
      </CardFooter>
    </Card>
  );
}
