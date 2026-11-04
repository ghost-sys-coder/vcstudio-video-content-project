import { Badge } from "@/components/ui/badge";
import type { ReadinessStatus } from "@/lib/readiness/readiness";
import { READINESS_STATUS_PRESENTATION } from "@/lib/readiness/readiness-presentation";

export function ReadinessStatusBadge({ status }: { status: ReadinessStatus }) {
  const presentation = READINESS_STATUS_PRESENTATION[status];
  return (
    <Badge
      variant="outline"
      className={`h-6 gap-1.5 px-2.5 ${presentation.className}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {presentation.label}
    </Badge>
  );
}
