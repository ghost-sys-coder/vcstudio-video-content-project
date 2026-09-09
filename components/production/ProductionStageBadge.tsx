import { Badge } from "@/components/ui/badge";
import { PRODUCTION_STAGE_LABELS } from "@/lib/production/production-queue-view";
import type { ProductionStage } from "@/lib/production/production-readiness";

/** How far the project has actually got, judged only by what exists. */
export function ProductionStageBadge({ stage }: { stage: ProductionStage }) {
  return (
    <Badge className="font-mono text-[0.7rem] uppercase" variant="outline">
      {PRODUCTION_STAGE_LABELS[stage]}
    </Badge>
  );
}
