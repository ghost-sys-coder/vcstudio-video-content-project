import { Badge } from "@/components/ui/badge";
import {
  RELEASE_STATE_LABELS,
  RELEASE_STATE_TONES,
} from "@/lib/production/production-queue-view";
import type { ReleaseState } from "@/lib/production/production-readiness";

/**
 * Release state only. It never reports "complete", because a rendered video and
 * a published one are different things and a scheduled one is neither.
 */
export function ProductionReleaseBadge({ state }: { state: ReleaseState }) {
  return (
    <Badge
      className={`h-6 px-2.5 text-xs ${RELEASE_STATE_TONES[state]}`}
      variant="outline"
    >
      {RELEASE_STATE_LABELS[state]}
    </Badge>
  );
}
