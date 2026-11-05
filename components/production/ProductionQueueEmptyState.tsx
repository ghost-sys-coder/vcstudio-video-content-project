import Link from "next/link";
import { ListChecks } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty } from "@/components/ui/Empty";

export function ProductionQueueEmptyState({
  filtered,
  hasOtherPages = false,
}: {
  filtered: boolean;
  hasOtherPages?: boolean;
}) {
  return (
    <Card className="min-w-0 shadow-sm">
      <CardContent>
        <Empty className="gap-4 border-0">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary">
            <ListChecks
              aria-hidden="true"
              className="size-5 text-muted-foreground"
            />
          </span>
          <div className="app-heading">
            <h3 className="text-base font-semibold">
              {filtered
                ? "Nothing matches these filters"
                : hasOtherPages
                  ? "No projects on this page"
                  : "No videos in production"}
            </h3>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {filtered
                ? hasOtherPages
                  ? "Adjust your filters or check another page for more projects."
                  : "Clear the filters to return to the full queue."
                : hasOtherPages
                  ? "Return to the first page to see your projects."
                  : "Create a project to start organizing your scripts, scenes and production work."}
            </p>
          </div>
          <Link
            href={filtered || hasOtherPages ? "/app/queue" : "/app/projects"}
            prefetch={false}
            className={buttonVariants({ variant: "outline" })}
          >
            {filtered
              ? "Clear filters"
              : hasOtherPages
                ? "Back to first page"
                : "Go to projects"}
          </Link>
        </Empty>
      </CardContent>
    </Card>
  );
}
