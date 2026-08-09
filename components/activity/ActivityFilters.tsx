import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  activityCategories,
  type ActivityCategory,
} from "@/lib/schemas/activity";

export function ActivityFilters({
  category,
  state,
}: {
  category?: ActivityCategory;
  state: "all" | "unread" | "acknowledged";
}) {
  const href = (nextCategory?: string, nextState = state) => {
    const params = new URLSearchParams();
    if (nextCategory) params.set("category", nextCategory);
    if (nextState !== "all") params.set("state", nextState);
    const query = params.toString();
    return query ? `/app/activity?${query}` : "/app/activity";
  };
  return (
    <nav aria-label="Activity filters" className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["all", "unread", "acknowledged"] as const).map((value) => (
          <Button
            key={value}
            nativeButton={false}
            size="sm"
            variant={state === value ? "default" : "outline"}
            render={<Link href={href(category, value)} />}
          >
            {value}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          nativeButton={false}
          size="sm"
          variant={!category ? "secondary" : "ghost"}
          render={<Link href={href(undefined)} />}
        >
          All categories
        </Button>
        {activityCategories.map((value) => (
          <Button
            key={value}
            nativeButton={false}
            size="sm"
            variant={category === value ? "secondary" : "ghost"}
            render={<Link href={href(value)} />}
          >
            {value.replaceAll("_", " ")}
          </Button>
        ))}
      </div>
    </nav>
  );
}
