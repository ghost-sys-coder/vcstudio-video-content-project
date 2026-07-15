import type { ProjectStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge
      variant={
        status === "failed"
          ? "destructive"
          : status === "completed"
            ? "default"
            : "secondary"
      }
    >
      {status.replace(/([A-Z])/g, " $1")}
    </Badge>
  );
}
