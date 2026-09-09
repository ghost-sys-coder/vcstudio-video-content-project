import Link from "next/link";
import { ArrowRightIcon, CheckCircle2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ProductionReadiness } from "@/lib/production/production-readiness";

/**
 * The one thing to do next.
 *
 * It is always a link. Opening a project must never start billable work or
 * skip an approval, so this navigates to where the decision is made and
 * nothing more.
 */
export function ProjectPrimaryAction({
  projectId,
  readiness,
}: {
  projectId: string;
  readiness: ProductionReadiness;
}) {
  if (!readiness.nextAction)
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2Icon aria-hidden className="size-4 text-emerald-600" />
        This video is published. Nothing is outstanding.
      </div>
    );

  const blocking = readiness.blockers.find(
    (entry) => entry.severity === "blocking",
  );
  const review = readiness.reviews[0];
  const reason =
    blocking?.message ??
    (review ? `${review.message}.` : "Continue production.");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 p-4">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Next step
        </p>
        <p className="mt-0.5 text-sm">{reason}</p>
      </div>
      <Button
        nativeButton={false}
        render={
          <Link
            href={`/app/projects/${projectId}/${readiness.nextAction.href}`}
          />
        }
      >
        {readiness.nextAction.label}
        <ArrowRightIcon aria-hidden className="size-4" />
      </Button>
    </div>
  );
}
