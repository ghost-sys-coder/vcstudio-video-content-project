import { z } from "zod";

/**
 * Formats the studio can read **today**.
 *
 * Plain text and Markdown parse with no dependency at all, which is why they
 * ship first: the whole upload → extract → include-in-context loop can be built
 * and verified before a PDF parser is argued about. PDF and DOCX arrive in a
 * later slice with their own dependency justification, and they run only in the
 * Trigger worker — never in a web request.
 */
export const MARKETING_DOCUMENT_EXTENSIONS = {
  "text/plain": "txt",
  "text/markdown": "md",
} as const;

export type MarketingDocumentContentType =
  keyof typeof MARKETING_DOCUMENT_EXTENSIONS;

export const MARKETING_DOCUMENT_CONTENT_TYPES = Object.keys(
  MARKETING_DOCUMENT_EXTENSIONS,
) as [MarketingDocumentContentType, ...MarketingDocumentContentType[]];

export const marketingDocumentContentTypeSchema = z.enum(
  MARKETING_DOCUMENT_CONTENT_TYPES,
);

export const MAX_DOCUMENT_TITLE_LENGTH = 200;
export const MAX_PASTED_DOCUMENT_CHARACTERS = 200_000;

export const requestDocumentUploadSchema = z.object({
  title: z.string().trim().min(1).max(MAX_DOCUMENT_TITLE_LENGTH),
  fileName: z.string().trim().min(1).max(300),
  contentType: marketingDocumentContentTypeSchema,
  sizeBytes: z.number().int().positive(),
});

export const completeDocumentUploadSchema = z.object({
  documentId: z.uuid(),
  contentType: marketingDocumentContentTypeSchema,
});

export const pasteDocumentSchema = z.object({
  title: z.string().trim().min(1).max(MAX_DOCUMENT_TITLE_LENGTH),
  body: z.string().trim().min(1).max(MAX_PASTED_DOCUMENT_CHARACTERS),
});

export const updateDocumentSchema = z.object({
  documentId: z.uuid(),
  title: z.string().trim().min(1).max(MAX_DOCUMENT_TITLE_LENGTH),
  includeInContext: z.boolean(),
  priority: z.number().int().min(0).max(100),
});

export const deleteDocumentSchema = z.object({ documentId: z.uuid() });

export const summariseDocumentSchema = z.object({ documentId: z.uuid() });

export type RequestDocumentUpload = z.infer<typeof requestDocumentUploadSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

/** Checkboxes are absent from FormData when unticked. */
export function readUpdateDocumentForm(
  formData: FormData,
): Record<string, unknown> {
  return {
    documentId: formData.get("documentId"),
    title: formData.get("title") ?? "",
    includeInContext: formData.get("includeInContext") === "on",
    priority: Number(formData.get("priority") ?? 0),
  };
}
