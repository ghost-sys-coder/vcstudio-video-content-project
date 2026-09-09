import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  PRODUCTION_QUEUE_ATTENTION_FILTERS,
  PRODUCTION_QUEUE_RELEASE_FILTERS,
  type ProductionQueueAttentionFilter,
  type ProductionQueueReleaseFilter,
} from "@/lib/production/production-queue-filters";
import {
  ATTENTION_FILTER_LABELS,
  RELEASE_FILTER_LABELS,
  buildProductionQueueHref,
} from "@/lib/production/production-queue-view";

/**
 * Link-based filters, so the queue stays a plain addressable URL that can be
 * bookmarked and shared. Changing a filter always returns to page one.
 */
export function ProductionQueueFilters({
  attention,
  channelProfileId,
  channels,
  release,
}: {
  attention: ProductionQueueAttentionFilter;
  channelProfileId: string | null;
  channels: { id: string; name: string }[];
  release: ProductionQueueReleaseFilter;
}) {
  return (
    <nav aria-label="Queue filters" className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRODUCTION_QUEUE_ATTENTION_FILTERS.map((value) => (
          <Button
            key={value}
            nativeButton={false}
            render={
              <Link
                href={buildProductionQueueHref({
                  attention: value,
                  channelProfileId,
                  release,
                })}
              />
            }
            size="sm"
            variant={attention === value ? "default" : "outline"}
          >
            {ATTENTION_FILTER_LABELS[value]}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {PRODUCTION_QUEUE_RELEASE_FILTERS.map((value) => (
          <Button
            key={value}
            nativeButton={false}
            render={
              <Link
                href={buildProductionQueueHref({
                  attention,
                  channelProfileId,
                  release: value,
                })}
              />
            }
            size="sm"
            variant={release === value ? "secondary" : "ghost"}
          >
            {RELEASE_FILTER_LABELS[value]}
          </Button>
        ))}
      </div>
      {channels.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            nativeButton={false}
            render={
              <Link
                href={buildProductionQueueHref({
                  attention,
                  channelProfileId: null,
                  release,
                })}
              />
            }
            size="sm"
            variant={channelProfileId === null ? "secondary" : "ghost"}
          >
            Every channel
          </Button>
          {channels.map((channel) => (
            <Button
              key={channel.id}
              nativeButton={false}
              render={
                <Link
                  href={buildProductionQueueHref({
                    attention,
                    channelProfileId: channel.id,
                    release,
                  })}
                />
              }
              size="sm"
              variant={channelProfileId === channel.id ? "secondary" : "ghost"}
            >
              {channel.name}
            </Button>
          ))}
        </div>
      ) : null}
    </nav>
  );
}
