import { AlertTriangleIcon, XCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TimelineValidationIssueView } from "@/lib/subtitles/subtitle-view";

export function TimelineValidationIssue({
  issue,
}: {
  issue: TimelineValidationIssueView;
}) {
  const isError = issue.severity === "error";
  const Icon = isError ? XCircleIcon : AlertTriangleIcon;

  return (
    <li
      className={cn(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-sm ring-1 ring-inset",
        isError
          ? "bg-destructive/5 text-destructive ring-destructive/20"
          : "bg-amber-100/40 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        {issue.sceneNumber !== null ? (
          <span className="font-mono text-xs font-semibold">
            Scene {issue.sceneNumber}:{" "}
          </span>
        ) : null}
        {issue.message}
      </span>
    </li>
  );
}
