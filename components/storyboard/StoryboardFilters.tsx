"use client";

import {
  STORYBOARD_FILTERS,
  type StoryboardFilter,
} from "@/lib/scenes/storyboard-filter";
import { cn } from "@/lib/utils";

export function StoryboardFilters({
  value,
  counts,
  onChange,
}: {
  value: StoryboardFilter;
  counts: Record<StoryboardFilter, number>;
  onChange: (filter: StoryboardFilter) => void;
}) {
  return (
    <div
      aria-label="Filter scenes by status"
      className="flex flex-wrap gap-1.5"
      role="group"
    >
      {STORYBOARD_FILTERS.map((filter) => (
        <button
          aria-pressed={value === filter.value}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition",
            value === filter.value
              ? "bg-primary text-primary-foreground ring-primary"
              : "bg-background text-muted-foreground ring-foreground/15 hover:bg-muted",
          )}
          key={filter.value}
          onClick={() => onChange(filter.value)}
          type="button"
        >
          {filter.label}
          <span className="ml-1.5 tabular-nums opacity-70">
            {counts[filter.value]}
          </span>
        </button>
      ))}
    </div>
  );
}
