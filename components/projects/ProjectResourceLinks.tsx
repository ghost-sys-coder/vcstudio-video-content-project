import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { PRODUCTION_RESOURCES } from "@/lib/production/production-stages";

/**
 * Characters and voices are workspace resources reused across projects, not
 * stages of this one. They are surfaced here so a creator can reach them
 * without hunting, while staying out of the stage sequence.
 */
export function ProjectResourceLinks() {
  return (
    <section aria-labelledby="project-resources-heading">
      <h2
        className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
        id="project-resources-heading"
      >
        Reusable resources
      </h2>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {PRODUCTION_RESOURCES.map((resource) => (
          <li key={resource.id}>
            <Link
              className="flex items-start justify-between gap-2 rounded-xl border p-3 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
              href={resource.href}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {resource.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {resource.description}
                </span>
              </span>
              <ArrowUpRightIcon
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
