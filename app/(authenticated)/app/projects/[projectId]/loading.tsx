import { PageSkeleton } from "@/components/ui/PageSkeleton";

/**
 * The project workspace pages, which all open with a view switcher above
 * several stacked panels. Loading shows that shape so the switcher does not
 * appear to jump into place once the data lands.
 */
export default function ProjectWorkspaceLoading() {
  return <PageSkeleton rowCount={2} showToolbar />;
}
