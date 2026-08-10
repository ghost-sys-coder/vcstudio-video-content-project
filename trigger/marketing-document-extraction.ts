import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  markDocumentExtracting,
  markDocumentFailed,
  markDocumentReady,
} from "@/db/commands/marketing-document-commands";
import { findKnowledgeDocument } from "@/db/repositories/marketing-documents.repository";
import { getMarketingEnvironment } from "@/lib/env/server";
import { extractStoredDocument } from "@/lib/marketing/documents/extract-stored-document";
import { marketingDocumentContentTypeSchema } from "@/lib/schemas/marketing-document";
import { readDocumentObject } from "@/lib/storage/marketing-document-storage";
import { isMarketingDocumentObjectKey } from "@/lib/storage/object-key";

export const marketingDocumentExtractionPayloadSchema = z.object({
  workspaceId: z.uuid(),
  documentId: z.uuid(),
});

export const marketingDocumentExtractionTask = task({
  id: "marketing-document-extraction",
  queue: { name: "media-processing", concurrencyLimit: 2 },
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 15_000,
    factor: 2,
    randomize: true,
  },
  maxDuration: 300,
  run: async (
    payload: z.infer<typeof marketingDocumentExtractionPayloadSchema>,
  ) => {
    const input = marketingDocumentExtractionPayloadSchema.parse(payload);
    const document = await findKnowledgeDocument(input);
    if (!document || document.deletedAt || !document.objectKey)
      return { status: "unavailable" as const };
    const contentType = marketingDocumentContentTypeSchema.parse(
      document.contentType,
    );
    if (
      !isMarketingDocumentObjectKey({
        ...input,
        contentType,
        objectKey: document.objectKey,
      })
    )
      throw new Error("INVALID_DOCUMENT_OBJECT_KEY");
    if (!(await markDocumentExtracting(input)))
      return { status: "unavailable" as const };
    let stored: Awaited<ReturnType<typeof readDocumentObject>>;
    try {
      stored = await readDocumentObject({
        objectKey: document.objectKey,
        maxBytes: getMarketingEnvironment().MARKETING_MAX_DOCUMENT_BYTES,
      });
    } catch (error) {
      await recordExtractionFailure({
        ...input,
        error,
        category: "storage_read_failed",
        safeMessage:
          "The uploaded document could not be retrieved from storage. Try reprocessing it.",
      });
      return { status: "failed" as const };
    }

    let extracted: Awaited<ReturnType<typeof extractStoredDocument>>;
    try {
      extracted = await extractStoredDocument({
        bytes: stored.bytes,
        contentType,
      });
      if (extracted.characterCount === 0) throw new Error("EMPTY_DOCUMENT");
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const passwordProtected = message.includes("password");
      const empty = message.includes("empty_document");
      await recordExtractionFailure({
        ...input,
        error,
        category: passwordProtected
          ? "password_protected"
          : empty
            ? "no_selectable_text"
            : "pdf_extraction_failed",
        safeMessage: passwordProtected
          ? "Password-protected documents are not supported. Remove the password and upload again."
          : empty
            ? "This document contains no selectable text. Upload a text-based PDF or paste its text."
            : "The PDF text could not be extracted. Try exporting it as a new PDF, then upload it again.",
      });
      return { status: "failed" as const };
    }

    try {
      await markDocumentReady({
        ...input,
        sizeBytes: stored.sizeBytes,
        extracted,
        chunks: extracted.chunks,
      });
      return { status: "ready" as const, chunkCount: extracted.chunks.length };
    } catch (error) {
      await recordExtractionFailure({
        ...input,
        error,
        category: "persistence_failed",
        safeMessage:
          "The document text was extracted but could not be saved. Try reprocessing it.",
      });
      return { status: "failed" as const };
    }
  },
});

async function recordExtractionFailure(input: {
  workspaceId: string;
  documentId: string;
  error: unknown;
  category: string;
  safeMessage: string;
}): Promise<void> {
  const errorName =
    input.error instanceof Error ? input.error.name : "UnknownError";
  const errorMessage =
    input.error instanceof Error
      ? input.error.message
      : "Unknown extraction failure";
  await markDocumentFailed({
    workspaceId: input.workspaceId,
    documentId: input.documentId,
    category: input.category,
    message: input.safeMessage,
  });
  logger.error("Knowledge document extraction failed.", {
    documentId: input.documentId,
    category: input.category,
    errorName,
    // Trigger logs are operator-only. Keep this bounded and never include
    // document text, object keys, signed URLs, or stack traces.
    errorMessage: errorMessage.slice(0, 500),
  });
}
