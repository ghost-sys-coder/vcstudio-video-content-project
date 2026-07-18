import { DownloadIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubtitleExportFormat } from "@/lib/subtitles/subtitle-view";

const FORMAT_LABEL: Record<SubtitleExportFormat, string> = {
  srt: "SRT",
  vtt: "WebVTT",
};

/**
 * Downloads the current subtitle track in the given format. The link points at
 * the authorized export route, which regenerates the deterministic cues on the
 * server so the download always matches the latest approved audio.
 */
export function ExportSubtitleButton({
  projectId,
  format,
  disabled,
}: {
  projectId: string;
  format: SubtitleExportFormat;
  disabled: boolean;
}) {
  const className = cn(buttonVariants({ variant: "outline", size: "sm" }));
  const label = (
    <>
      <DownloadIcon aria-hidden />
      Export {FORMAT_LABEL[format]}
    </>
  );

  if (disabled)
    return (
      <span aria-disabled className={cn(className, "opacity-50")}>
        {label}
      </span>
    );

  return (
    <a
      className={className}
      download
      href={`/api/projects/${projectId}/subtitles/export?format=${format}`}
      rel="noopener"
    >
      {label}
    </a>
  );
}
