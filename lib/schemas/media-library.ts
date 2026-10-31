import { z } from "zod";

export const mediaLibraryQuerySchema = z.object({
  kind: z.enum(["image", "video", "audio"]).optional(),
  cursor: z.string().max(512).optional(),
});

export const mediaPickerQuerySchema = mediaLibraryQuerySchema.extend({
  kind: z.enum(["image", "video"]).optional(),
});

export const mediaLibraryCursorSchema = z.object({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  direction: z.enum(["next", "previous"]),
});

export type MediaLibraryCursor = z.infer<typeof mediaLibraryCursorSchema>;
