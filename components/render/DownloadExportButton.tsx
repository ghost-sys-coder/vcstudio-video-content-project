import { DownloadIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Links to the authorized download route (never a raw signed URL), which
 * checks workspace access before redirecting to a short-lived signed URL.
 */
export function DownloadExportButton({
  projectId,
  renderId,
  disabled,
}: {
  projectId: string;
  renderId: string;
  disabled: boolean;
}) {
  if (disabled)
    return (
      <span
        aria-disabled
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "pointer-events-none opacity-50",
        )}
      >
        <DownloadIcon aria-hidden />
        Download
      </span>
    );

  return (
    <a
      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      href={`/api/projects/${projectId}/renders/${renderId}/download`}
      rel="noopener noreferrer"
      target="_blank"
    >
      <DownloadIcon aria-hidden />
      Download
    </a>
  );
}
