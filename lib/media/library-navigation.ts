import type { MediaAssetKind } from "@/db/schema";

export const MEDIA_LIBRARY_PAGE_SIZE = 24;

export function mediaLibraryHref(
  kind?: MediaAssetKind | null,
  cursor?: string | null,
  basePath = "/app/social/library",
): string {
  const query = new URLSearchParams();
  if (kind) query.set("kind", kind);
  if (cursor) query.set("cursor", cursor);
  return `${basePath}${query.size > 0 ? `?${query}` : ""}`;
}
