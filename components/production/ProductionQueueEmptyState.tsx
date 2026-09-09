import Link from "next/link";
import { ListChecksIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Distinguishes an empty workspace from an empty filter, so a creator is never
 * told they have no work when they have merely filtered it all away.
 */
export function ProductionQueueEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <ListChecksIcon
        aria-hidden
        className="mx-auto size-8 text-muted-foreground"
      />
      <p className="mt-3 font-medium">
        {filtered ? "Nothing matches these filters" : "No videos in production"}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {filtered
          ? "Every project is filtered out. Clear the filters to see the whole queue."
          : "Create a project and its script to start the production queue."}
      </p>
      <div className="mt-4">
        <Button
          nativeButton={false}
          render={<Link href={filtered ? "/app/queue" : "/app/projects"} />}
          size="sm"
          variant="outline"
        >
          {filtered ? "Clear the filters" : "Go to projects"}
        </Button>
      </div>
    </div>
  );
}
