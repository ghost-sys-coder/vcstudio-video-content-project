import { PageSkeleton } from "@/components/ui/PageSkeleton";

/**
 * Covers every page under `/app` that does not define its own.
 *
 * One file rather than fifty-seven: a segment's `loading.tsx` applies to each
 * route nested beneath it, so the routes that need a particular shape can
 * still override it and the rest inherit something better than a blank screen.
 */
export default function AppLoading() {
  return <PageSkeleton rowCount={3} />;
}
