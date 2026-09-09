import { Badge } from "@/components/ui/badge";
import { RELEASE_STATE_LABELS } from "@/lib/production/production-queue-view";
import type { ReleaseState } from "@/lib/production/production-readiness";

/**
 * Release state only. It never reports "complete", because a rendered video and
 * a published one are different things and a scheduled one is neither.
 */
export function ProductionReleaseBadge({ state }: { state: ReleaseState }) {
  const tone: Record<ReleaseState, string> = {
    published:
      "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
    rendered:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    scheduled: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
    unpublished: "",
  };
  return (
    <Badge
      className={tone[state] || undefined}
      variant={state === "unpublished" ? "secondary" : undefined}
    >
      {RELEASE_STATE_LABELS[state]}
    </Badge>
  );
}
