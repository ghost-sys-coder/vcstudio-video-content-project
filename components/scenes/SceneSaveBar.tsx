"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The scene form's save control, which follows the creator down a long form.
 *
 * It sticks to the bottom of the viewport only while there is something to
 * save. A bar that is always pinned steals height from every scene the creator
 * is merely reading, and a save control that is never in reach is why the form
 * looked as though it had none — sticking while dirty answers both.
 *
 * Sticky positioning needs no scroll-clipping ancestor between here and the
 * page, which is why the scene card drops its `overflow-hidden`.
 */
export function SceneSaveBar({
  dirty,
  impact,
  pending,
}: {
  /** True when the form holds changes that are not yet saved. */
  dirty: boolean;
  /** What saving does to this scene's finished media, in one line. */
  impact: string;
  pending: boolean;
}) {
  return (
    <div
      className={cn(
        "-mx-1 space-y-2 rounded-lg px-1 py-2 transition-colors",
        dirty &&
          "sticky bottom-0 z-10 border-t bg-card/95 shadow-[0_-8px_16px_-12px_var(--color-foreground)] backdrop-blur",
      )}
    >
      <p className="text-sm text-muted-foreground" role="status">
        {impact}
      </p>
      <Button disabled={pending || !dirty} type="submit">
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
