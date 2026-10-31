"use server";

import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  loadMediaLibraryPage,
  type MediaLibraryPageView,
} from "@/lib/media/load-media-library";
import { can } from "@/lib/policies/workspace-policy";
import { decodeLibraryCursor } from "@/lib/media/library-cursor";
import { mediaPickerQuerySchema } from "@/lib/schemas/media-library";

export async function getMediaLibraryPageAction(
  input: unknown,
): Promise<
  { ok: true; view: MediaLibraryPageView } | { ok: false; error: string }
> {
  const parsed = mediaPickerQuerySchema.safeParse(input);
  if (
    !parsed.success ||
    (parsed.data.cursor && !decodeLibraryCursor(parsed.data.cursor))
  )
    return { ok: false, error: "The media library request is invalid." };
  const context = await getAuthenticatedWorkspaceContext();
  if (!context || !can(context.activeMembership.role, "composePosts"))
    return {
      ok: false,
      error: "You do not have permission to view this library.",
    };
  try {
    return {
      ok: true,
      view: await loadMediaLibraryPage({
        workspaceId: context.activeMembership.workspaceId,
        ...parsed.data,
        visualOnly: true,
      }),
    };
  } catch {
    console.error("Media library page read failed.", {
      workspaceId: context.activeMembership.workspaceId,
    });
    return {
      ok: false,
      error: "The media library could not be loaded. Please try again.",
    };
  }
}
