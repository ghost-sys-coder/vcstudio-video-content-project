import type { SceneStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function SceneStatusBadge({ status }: { status: SceneStatus }) {
  const approved = status === "approved";

  return (
    <Badge
      className={cn(
        "h-6 px-3 py-1 capitalize",
        approved &&
          "border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
      )}
      variant={approved ? "outline" : "secondary"}
    >
      {status.replace(/([A-Z])/g, " $1")}
    </Badge>
  );
}
