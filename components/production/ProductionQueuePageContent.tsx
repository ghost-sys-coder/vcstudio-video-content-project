import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { ProductionQueueEmptyState } from "./ProductionQueueEmptyState";
import { ProductionQueueFilters } from "./ProductionQueueFilters";
import { ProductionQueueOverview } from "./ProductionQueueOverview";
import { ProductionQueuePagination } from "./ProductionQueuePagination";
import { ProductionQueueRow } from "./ProductionQueueRow";
import type { ProductionQueuePage } from "@/db/repositories/production-queue.repository";
import type {
  ProductionQueueAttentionFilter,
  ProductionQueueReleaseFilter,
} from "@/lib/production/production-queue-filters";

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
    <section
      aria-labelledby="queue-heading"
      className="app-page font-[family-name:var(--font-geist-sans,Arial,sans-serif)]"
    >
      <header className="app-page-header items-center">
        <div className="app-heading max-w-2xl">
          <p className="text-sm font-medium text-muted-foreground">
            Workspace production
          </p>
          <h1
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
            id="queue-heading"
          >
            Production queue
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            Keep each video moving. See where it stands, what needs attention
            and the next step to take.
          </p>
        </div>
        <Link
          href="/app/projects"
          prefetch={false}
          className={buttonVariants({ variant: "outline" })}
        >
          View projects <ArrowUpRight aria-hidden="true" />
        </Link>
      </header>
      <ProductionQueueOverview items={queue.items} />
      <ProductionQueueFilters
        attention={attention}
        channelProfileId={channelProfileId}
        channels={channels}
        release={release}
      />
      <section className="app-section" aria-labelledby="queue-projects-heading">
        <div className="app-page-header items-center">
          <div className="app-heading">
            <h2
              id="queue-projects-heading"
              className="text-xl font-semibold tracking-tight"
            >
              Projects
            </h2>
            <p className="text-sm text-muted-foreground">
              {attention !== "all" || release !== "all"
                ? "Readiness and release filters apply within each page. Check other pages for more matches."
                : "Planned releases first, followed by recently updated projects."}
            </p>
          </div>
          <Badge variant="secondary" className="h-6 px-2.5">
            {queue.items.length} shown
          </Badge>
        </div>
        {queue.items.length === 0 ? (
          <ProductionQueueEmptyState
            filtered={filtered}
            hasOtherPages={queue.total > 0}
          />
        ) : (
          <ul aria-label="Production projects" className="grid min-w-0 gap-4">
            {queue.items.map((item) => (
              <ProductionQueueRow item={item} key={item.projectId} />
            ))}
          </ul>
        )}
        <ProductionQueuePagination
          queue={queue}
          attention={attention}
          channelProfileId={channelProfileId}
          release={release}
        />
      </section>
    </section>
  );
}
