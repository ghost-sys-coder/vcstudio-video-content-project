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
    <ul className="space-y-1">
      {reviews.map((review) => (
        <li className="flex items-start gap-1.5 text-xs" key={review.kind}>
          <EyeIcon
            aria-hidden
            className="mt-0.5 size-3.5 shrink-0 text-amber-600"
          />
          <span className="text-amber-700 dark:text-amber-500">
            {review.message}{" "}
            <Link
              className="underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2"
              href={`/app/projects/${projectId}/${review.action.href}`}
            >
              {review.action.label}
            </Link>
          </span>
        </li>
      ))}
    </ul>
  );
}
