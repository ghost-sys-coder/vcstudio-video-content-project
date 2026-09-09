import Link from "next/link";
import { AlertTriangleIcon, InfoIcon } from "lucide-react";
import type { ProductionBlocker } from "@/lib/production/production-readiness";

/**
 * Every blocker carries its own recovery link, so a failure is never a dead end
 * the creator has to go hunting for.
 */
export function ProductionBlockerList({
  blockers,
  projectId,
}: {
  blockers: ProductionBlocker[];
  projectId: string;
}) {
  if (blockers.length === 0) return null;
  return (
    <ul className="space-y-1">
      {blockers.map((blocker) => (
        <li className="flex items-start gap-1.5 text-xs" key={blocker.kind}>
          {blocker.severity === "blocking" ? (
            <AlertTriangleIcon
              aria-hidden
              className="mt-0.5 size-3.5 shrink-0 text-destructive"
            />
          ) : (
            <InfoIcon
              aria-hidden
              className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
            />
          )}
          <span
            className={
              blocker.severity === "blocking"
                ? "text-destructive"
                : "text-muted-foreground"
            }
          >
            {blocker.message}{" "}
            <Link
              className="underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
              href={`/app/projects/${projectId}/${blocker.action.href}`}
            >
              {blocker.action.label}
            </Link>
          </span>
        </li>
      ))}
    </ul>
  );
}
