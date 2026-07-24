import type { ProjectStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";

export function ProjectStatusBadge({
  status,
  hasPublished,
}: {
  status: ProjectStatus;
  hasPublished?: boolean;
}) {
  if (status === "planning" && hasPublished)
    return (
      <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300">
        Published
      </Badge>
    );

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
