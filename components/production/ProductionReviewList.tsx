import Link from "next/link";
import { EyeIcon } from "lucide-react";
import type { ProductionReview } from "@/lib/production/production-readiness";

/** Outstanding review work, counted and linked to where it is cleared. */
export function ProductionReviewList({
  reviews,
  projectId,
}: {
  reviews: ProductionReview[];
  projectId: string;
}) {
  if (reviews.length === 0) return null;
  return (
    <ul className="space-y-2">
      {reviews.map((review) => (
        <li
          className="flex min-w-0 items-start gap-2 text-sm leading-relaxed"
          key={review.kind}
        >
          <EyeIcon
            aria-hidden
            className="mt-1 size-3.5 shrink-0 text-notice-warning-foreground"
          />
          <span className="text-notice-warning-foreground [overflow-wrap:anywhere]">
            {review.message}{" "}
            <Link
              className="underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
              href={`/app/projects/${projectId}/${review.action.href}`}
              prefetch={false}
            >
              {review.action.label}
            </Link>
          </span>
        </li>
      ))}
    </ul>
  );
}
