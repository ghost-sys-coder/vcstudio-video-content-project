import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { MediaAssetKind } from "@/db/schema";
import { mediaLibraryHref } from "@/lib/media/library-navigation";

export function MediaLibraryPagination({
  kind,
  nextCursor,
  previousCursor,
  basePath,
}: {
  kind: MediaAssetKind | null;
  nextCursor?: string | null;
  previousCursor?: string | null;
  basePath?: string;
}) {
  if (!nextCursor && !previousCursor) return null;
  return (
    <nav
      aria-label="Media library pages"
      className="flex flex-wrap justify-between gap-4"
    >
      <Button
        disabled={!previousCursor}
        nativeButton={!previousCursor}
        render={
          previousCursor ? (
            <Link
              href={mediaLibraryHref(kind, previousCursor, basePath)}
              prefetch={false}
            />
          ) : undefined
        }
        variant="outline"
      >
        Previous
      </Button>
      <Button
        disabled={!nextCursor}
        nativeButton={!nextCursor}
        render={
          nextCursor ? (
            <Link
              href={mediaLibraryHref(kind, nextCursor, basePath)}
              prefetch={false}
            />
          ) : undefined
        }
        variant="outline"
      >
        Next
      </Button>
    </nav>
  );
}
