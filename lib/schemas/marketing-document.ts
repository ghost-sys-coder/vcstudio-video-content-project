import { z } from "zod";

/**
 * Formats the studio can read **today**.
 *
 * Binary formats are accepted by the web tier but parsed only by the Trigger
 * worker. Keeping this map shared makes the signed object key and parser agree.
 */
export const MARKETING_DOCUMENT_EXTENSIONS = {
  "text/plain": "txt",
  "text/markdown": "md",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
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
  freshForDays: z.number().int().min(0).max(3650),
});

export const deleteDocumentSchema = z.object({ documentId: z.uuid() });

export const summariseDocumentSchema = z.object({ documentId: z.uuid() });
export const reprocessDocumentSchema = z.object({ documentId: z.uuid() });

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
    freshForDays: Number(formData.get("freshForDays") ?? 0),
  };
}
