import Link from "next/link";
import { LibraryLensGrid } from "@/components/marketing/LibraryLensGrid";
import { EmptyMediaLibraryState } from "@/components/social/EmptyMediaLibraryState";
import { Button } from "@/components/ui/button";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadMediaLibrary } from "@/lib/media/load-media-library";

/**
 * A read-only lens onto the existing workspace media library.
 *
 * Deliberately not a second library: uploading and editing live in the Social
 * segment, and duplicating them here would mean two upload paths and two places
 * for the limits to disagree. This exists so somebody tagging brand assets can
 * see what is available without leaving the segment.
 */
export default async function MarketingLibraryLensPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;

  const library = await loadMediaLibrary({
    workspaceId: context.activeMembership.workspaceId,
  });

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Everything in this workspace&apos;s media library. Uploading and
          editing happen in Social.
        </p>
        <Button
          nativeButton={false}
          render={<Link href="/app/social/library" />}
          variant="outline"
        >
          Open media library
        </Button>
      </div>

      {library.assets.length === 0 ? (
        <EmptyMediaLibraryState filtered={false} />
      ) : (
        <LibraryLensGrid assets={library.assets} />
      )}
    </div>
  );
}
