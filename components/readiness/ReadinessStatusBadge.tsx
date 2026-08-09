import { Badge } from "@/components/ui/badge";
import type { ReadinessStatus } from "@/lib/readiness/readiness";

const labels: Record<ReadinessStatus, string> = {
  ready: "Ready",
  degraded: "Degraded",
  blocked: "Blocked",
  disabled: "Disabled",
  unknown: "Unknown",
};
const variants: Record<
  ReadinessStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ready: "default",
  degraded: "secondary",
  blocked: "destructive",
  disabled: "outline",
  unknown: "outline",
};

export function ReadinessStatusBadge({ status }: { status: ReadinessStatus }) {
  return <Badge variant={variants[status]}>{labels[status]}</Badge>;
}
