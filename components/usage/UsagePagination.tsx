import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export function UsagePagination({
  label,
  page,
  pageCount,
  total,
  prevHref,
  nextHref,
}: {
  label: string;
  page: number;
  pageCount: number;
  total: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-4">
      <p className="text-xs text-muted-foreground">
        Page{" "}
        <span className="font-medium tabular-nums text-foreground">{page}</span>{" "}
        of {pageCount}
        <span aria-hidden="true"> · </span>
        {total} events
      </p>
      <nav aria-label={`${label} pagination`} className="flex gap-2">
        {prevHref ? (
          <Link
            href={prevHref}
            prefetch={false}
            className={buttonVariants({ variant: "outline" })}
          >
            <ChevronLeft aria-hidden="true" />
            Previous
          </Link>
        ) : (
          <Button variant="outline" disabled>
            <ChevronLeft aria-hidden="true" />
            Previous
          </Button>
        )}
        {nextHref ? (
          <Link
            href={nextHref}
            prefetch={false}
            className={buttonVariants({ variant: "outline" })}
          >
            Next
            <ChevronRight aria-hidden="true" />
          </Link>
        ) : (
          <Button variant="outline" disabled>
            Next
            <ChevronRight aria-hidden="true" />
          </Button>
        )}
      </nav>
    </div>
  );
}
