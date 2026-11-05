import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ProductionQueuePage } from "@/db/repositories/production-queue.repository";
import type {
  ProductionQueueAttentionFilter,
  ProductionQueueReleaseFilter,
} from "@/lib/production/production-queue-filters";
import { buildProductionQueueHref } from "@/lib/production/production-queue-view";

export function ProductionQueuePagination({
  queue,
  attention,
  channelProfileId,
  release,
}: {
  queue: ProductionQueuePage;
  attention: ProductionQueueAttentionFilter;
  channelProfileId: string | null;
  release: ProductionQueueReleaseFilter;
}) {
  if (queue.pageCount <= 1 && queue.page <= 1) return null;
  return (
    <nav
      aria-label="Queue pagination"
      className="flex flex-wrap items-center justify-between gap-4 border-t pt-5"
    >
      <p className="text-sm tabular-nums text-muted-foreground">
        Page {queue.page} of {queue.pageCount}
      </p>
      <div className="flex gap-2">
        {queue.page > 1 ? (
          <Link
            href={buildProductionQueueHref({
              attention,
              channelProfileId,
              release,
              page: queue.page - 1,
            })}
            prefetch={false}
            className={buttonVariants({ variant: "outline" })}
          >
            <ChevronLeft aria-hidden="true" />
            Previous
          </Link>
        ) : (
          <Button variant="outline" disabled>
            <ChevronLeft aria-hidden="true" />
            Previous
          </Button>
        )}
        {queue.page < queue.pageCount ? (
          <Link
            href={buildProductionQueueHref({
              attention,
              channelProfileId,
              release,
              page: queue.page + 1,
            })}
            prefetch={false}
            className={buttonVariants({ variant: "outline" })}
          >
            Next
            <ChevronRight aria-hidden="true" />
          </Link>
        ) : (
          <Button variant="outline" disabled>
            Next
            <ChevronRight aria-hidden="true" />
          </Button>
        )}
      </div>
    </nav>
  );
}
