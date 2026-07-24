import { Badge } from "@/components/ui/badge";
import type { PublicationView } from "@/lib/publishing/publishing-view";

const STATUS_LABELS: Record<PublicationView["status"], string> = {
  pending: "Preparing",
  queued: "Queued",
  uploading: "Uploading",
  processing: "Processing",
  succeeded: "Published",
  failed: "Failed",
  cancelled: "Cancelled",
};

const BADGE_SIZE_CLASSNAME = "h-auto px-2.5 py-1";

export function VideoPublicationStatusBadge({
  status,
  label,
}: {
  status: PublicationView["status"];
  label?: string;
}) {
  const text = label ?? STATUS_LABELS[status];

  if (status === "succeeded")
    return (
      <Badge
        className={`${BADGE_SIZE_CLASSNAME} bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300`}
      >
        {text}
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge className={BADGE_SIZE_CLASSNAME} variant="destructive">
        {text}
      </Badge>
    );
  if (status === "cancelled")
    return (
      <Badge
        className={`${BADGE_SIZE_CLASSNAME} bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300`}
      >
        {text}
      </Badge>
    );
  if (status === "uploading" || status === "processing")
    return (
      <Badge
        className={`${BADGE_SIZE_CLASSNAME} bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300`}
      >
        {text}
      </Badge>
    );
  if (status === "queued")
    return (
      <Badge
        className={`${BADGE_SIZE_CLASSNAME} bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300`}
      >
        {text}
      </Badge>
    );
  return (
    <Badge className={BADGE_SIZE_CLASSNAME} variant="secondary">
      {text}
    </Badge>
  );
}
