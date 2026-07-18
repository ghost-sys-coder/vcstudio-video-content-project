import { Badge } from "@/components/ui/badge";
import type { RenderExportView } from "@/lib/render/render-view";

const LABELS: Record<RenderExportView["status"], string> = {
  pending: "Pending",
  queued: "Queued",
  running: "Rendering",
  succeeded: "Ready",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function RenderStatusBadge({
  status,
}: {
  status: RenderExportView["status"];
}) {
  if (status === "succeeded")
    return (
      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        {LABELS.succeeded}
      </Badge>
    );
  if (status === "failed")
    return <Badge variant="destructive">{LABELS.failed}</Badge>;
  if (status === "cancelled")
    return <Badge variant="outline">{LABELS.cancelled}</Badge>;
  return <Badge variant="secondary">{LABELS[status]}</Badge>;
}
