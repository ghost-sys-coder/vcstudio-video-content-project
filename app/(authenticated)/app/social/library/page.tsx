import { redirect } from "next/navigation";
import { MediaLibraryWorkspace } from "@/components/social/MediaLibraryWorkspace";
import type { MediaAssetKind } from "@/db/schema";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { getMediaLibraryEnvironment } from "@/lib/env/server";
import { loadMediaLibrary } from "@/lib/media/load-media-library";
import { can } from "@/lib/policies/workspace-policy";

function parseKind(
  value: string | string[] | undefined,
): MediaAssetKind | undefined {
  return value === "image" || value === "video" ? value : undefined;
}

export default async function MediaLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string | string[] }>;
}) {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) redirect("/onboarding");
  if (!can(context.activeMembership.role, "composePosts"))
    redirect("/app/access-denied");

  const { kind } = await searchParams;
  const limits = getMediaLibraryEnvironment();
  const view = await loadMediaLibrary({
    workspaceId: context.activeMembership.workspaceId,
    kind: parseKind(kind),
  });

  return (
    // Keyed on the filter so switching it remounts with that filter's assets,
    // rather than syncing the new server list into client state from an effect.
    <MediaLibraryWorkspace
      canEdit={can(context.activeMembership.role, "manageMediaLibrary")}
      key={view.kind ?? "all"}
      maxImageBytes={limits.MAX_MEDIA_IMAGE_BYTES}
      maxVideoBytes={limits.MAX_MEDIA_VIDEO_BYTES}
      view={view}
      workspaceId={context.activeMembership.workspaceId}
    />
  );
}
