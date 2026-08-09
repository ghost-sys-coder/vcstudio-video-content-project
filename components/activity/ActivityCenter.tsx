import Link from "next/link";
import { Inbox } from "lucide-react";
import { ActivityFilters } from "@/components/activity/ActivityFilters";
import { ActivityItemCard } from "@/components/activity/ActivityItemCard";
import { Button } from "@/components/ui/button";
import type { ActivityItem } from "@/db/repositories/activity.repository";
import type { ActivityCategory } from "@/lib/schemas/activity";

export function ActivityCenter({
  workspaceId,
  filters,
  view,
}: {
  workspaceId: string;
  filters: {
    category?: ActivityCategory;
    state: "all" | "unread" | "acknowledged";
    page: number;
  };
  view: { items: ActivityItem[]; hasNextPage: boolean };
}) {
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.state !== "all") params.set("state", filters.state);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/app/activity?${query}` : "/app/activity";
  };
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
      <header>
        <p className="text-sm font-medium text-primary">
          Workspace attention inbox
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Activity</h1>
        <p className="mt-2 text-muted-foreground">
          Review completions, failures, skipped schedules, and integration
          issues without changing their workflow state.
        </p>
      </header>
      <ActivityFilters category={filters.category} state={filters.state} />
      <section aria-label="Activity items" className="space-y-3">
        {view.items.length ? (
          view.items.map((item) => (
            <ActivityItemCard
              key={item.key}
              item={item}
              workspaceId={workspaceId}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed p-12 text-center">
            <Inbox className="mx-auto mb-3 size-8 text-muted-foreground" />
            <h2 className="font-semibold">Nothing needs attention</h2>
            <p className="text-sm text-muted-foreground">
              No activity matches these filters.
            </p>
          </div>
        )}
      </section>
      <nav aria-label="Activity pages" className="flex justify-between">
        <Button
          nativeButton={filters.page === 1}
          variant="outline"
          disabled={filters.page === 1}
          render={
            filters.page > 1 ? (
              <Link href={pageHref(filters.page - 1)} />
            ) : undefined
          }
        >
          Previous
        </Button>
        <span className="self-center text-sm text-muted-foreground">
          Page {filters.page}
        </span>
        <Button
          nativeButton={!view.hasNextPage}
          variant="outline"
          disabled={!view.hasNextPage}
          render={
            view.hasNextPage ? (
              <Link href={pageHref(filters.page + 1)} />
            ) : undefined
          }
        >
          Next
        </Button>
      </nav>
    </main>
  );
}
