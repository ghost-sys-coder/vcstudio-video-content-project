import { AlertTriangleIcon } from "lucide-react";

export function AudioErrorState({
  safeErrorMessage,
}: {
  safeErrorMessage: string | null;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-destructive/5 p-2.5 text-xs text-destructive ring-1 ring-inset ring-destructive/20">
      <AlertTriangleIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {safeErrorMessage ??
          "This narration could not be generated. Generate a new version to try again."}
      </span>
    </div>
  );
}
