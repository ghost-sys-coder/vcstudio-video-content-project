import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProductionQueueEmptyState } from "@/components/production/ProductionQueueEmptyState";
import { ProductionQueueFilters } from "@/components/production/ProductionQueueFilters";
import { ProductionQueueRow } from "@/components/production/ProductionQueueRow";
import type { ProductionQueuePage } from "@/db/repositories/production-queue.repository";
import type {
  ProductionQueueAttentionFilter,
  ProductionQueueReleaseFilter,
} from "@/lib/production/production-queue-filters";
import { buildProductionQueueHref } from "@/lib/production/production-queue-view";

export function ProductionQueuePageContent({
  attention,
  channelProfileId,
  channels,
  queue,
  release,
}: {
  attention: ProductionQueueAttentionFilter;
  channelProfileId: string | null;
  channels: { id: string; name: string }[];
  queue: ProductionQueuePage;
  release: ProductionQueueReleaseFilter;
}) {
  const filtered =
    attention !== "all" || release !== "all" || channelProfileId !== null;

  return (
    <section aria-labelledby="queue-heading" className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-tight" id="queue-heading">
          Production queue
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every video by channel and intended release, with what is blocking it
          and the next thing to do. Progress here is read from actual scripts,
          scenes, assets, renders and publications, never from a status set by
          hand.
        </p>
      </div>

      <ProductionQueueFilters
        attention={attention}
        channelProfileId={channelProfileId}
        channels={channels}
        release={release}
      />

      {queue.items.length === 0 ? (
        <ProductionQueueEmptyState filtered={filtered} />
      ) : (
        <ul className="space-y-3">
          {queue.items.map((item) => (
            <ProductionQueueRow item={item} key={item.projectId} />
          ))}
        </ul>
      )}

      {queue.pageCount > 1 ? (
        <nav
          aria-label="Queue pagination"
          className="flex items-center justify-between border-t pt-4"
        >
          <p className="text-sm text-muted-foreground">
            Page {queue.page} of {queue.pageCount}
          </p>
          <div className="flex gap-2">
            <Button
              aria-disabled={queue.page <= 1}
              className={
                queue.page <= 1 ? "pointer-events-none opacity-50" : ""
              }
              nativeButton={false}
              render={
                <Link
                  href={buildProductionQueueHref({
                    attention,
                    channelProfileId,
                    page: queue.page - 1,
                    release,
                  })}
                />
              }
              size="sm"
              variant="outline"
            >
              Previous
            </Button>
            <Button
              aria-disabled={queue.page >= queue.pageCount}
              className={
                queue.page >= queue.pageCount
                  ? "pointer-events-none opacity-50"
                  : ""
              }
              nativeButton={false}
              render={
                <Link
                  href={buildProductionQueueHref({
                    attention,
                    channelProfileId,
                    page: queue.page + 1,
                    release,
                  })}
                />
              }
              size="sm"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </nav>
      ) : null}
    </section>
  );
}
