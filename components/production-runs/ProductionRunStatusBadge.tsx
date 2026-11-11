import { Badge } from "@/components/ui/badge";
import type { ProductionRunStatus } from "@/lib/production-runs/production-run-state";

const VARIANTS: Record<
  ProductionRunStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  queued: "secondary",
  running: "default",
  held: "outline",
  ready_for_review: "default",
  failed: "destructive",
  cancelled: "secondary",
};

export function ProductionRunStatusBadge({
  label,
  status,
}: {
  label: string;
  status: ProductionRunStatus;
}) {
  return (
    <Badge
      className={
        status === "held"
          ? "border-amber-500/60 text-amber-700 dark:text-amber-400"
          : undefined
      }
      variant={VARIANTS[status]}
    >
      {label}
    </Badge>
  );
}
