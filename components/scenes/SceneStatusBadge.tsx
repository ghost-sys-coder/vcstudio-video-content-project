import type { SceneStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";

export function SceneStatusBadge({ status }: { status: SceneStatus }) {
  return (
    <Badge variant={status === "approved" ? "default" : "secondary"}>
      {status.replace(/([A-Z])/g, " $1")}
    </Badge>
  );
}
