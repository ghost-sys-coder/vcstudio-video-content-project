import "server-only";
import {
  mediaLibraryCursorSchema,
  type MediaLibraryCursor,
} from "@/lib/schemas/media-library";

export function decodeLibraryCursor(value?: string): MediaLibraryCursor | null {
  if (!value || value.length > 512) return null;
  try {
    const parsed = mediaLibraryCursorSchema.safeParse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function encodeLibraryCursor(value: MediaLibraryCursor): string {
  return Buffer.from(
    JSON.stringify(mediaLibraryCursorSchema.parse(value)),
  ).toString("base64url");
}
