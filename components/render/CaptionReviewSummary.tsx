import Link from "next/link";
import { CaptionsIcon } from "lucide-react";
import { describeCaptionReview } from "@/lib/render/caption-review-summary";

/**
 * Caption state, shown where the video is assembled.
 *
 * It links into the captions view rather than embedding the editor, so the
 * detailed editor and its deep links stay exactly where they were.
 */
export function CaptionReviewSummary({
  projectId,
  captionCount,
  captionsEnabled,
  timelineStatus,
}: {
  projectId: string;
  captionCount: number;
  captionsEnabled: boolean;
  timelineStatus: "ready" | "invalid";
}) {
  const summary = describeCaptionReview({
    captionCount,
    captionsEnabled,
    timelineStatus,
  });

  return (
    <section
      aria-label="Caption review"
      className="rounded-xl border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <CaptionsIcon aria-hidden className="size-4" />
          Captions
        </h2>
        <span
          className={
            summary.tone === "ready"
              ? "text-xs font-medium text-emerald-600 dark:text-emerald-400"
              : summary.tone === "unreviewed"
                ? "text-xs font-medium text-amber-600 dark:text-amber-400"
                : "text-xs font-medium text-muted-foreground"
          }
        >
          {summary.headline}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{summary.detail}</p>
      <Link
        className="mt-3 inline-block text-xs font-medium underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        href={`/app/projects/${projectId}/subtitles`}
      >
        {summary.actionLabel}
      </Link>
    </section>
  );
}
