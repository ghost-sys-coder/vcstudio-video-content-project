import { z } from "zod";
import { portableDocumentSchema } from "@/lib/social/portable-document";
export const marketingContentIdSchema = z.object({ contentItemId: z.uuid() });
export const reviewMarketingContentSchema = z.object({
  contentItemId: z.uuid(),
  decision: z.enum(["approve", "request_changes", "archive"]),
  reviewNotes: z.string().trim().max(4000).default(""),
});
export const updateMarketingContentSchema = z.object({
  contentItemId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  bodyDocument: portableDocumentSchema,
});
