import type { ReleasePackageStatus } from "@/lib/releases/release-package";

const LABELS: Record<ReleasePackageStatus, string> = {
  // "Ready" says only that the packaging is decided and reviewed. It never
  // claims the video is published or scheduled, which are separate states.
  ready: "Reviewed and ready",
  stale: "Needs review again",
  incomplete: "Not finished",
};

const CLASSES: Record<ReleasePackageStatus, string> = {
  ready:
    "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900",
  stale:
    "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:ring-amber-900",
  incomplete: "bg-muted text-muted-foreground ring-foreground/15",
};

export function ReleasePackageStatusBadge({
  status,
}: {
  status: ReleasePackageStatus;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${CLASSES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
