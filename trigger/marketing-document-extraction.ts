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
    try {
      const stored = await readDocumentObject({
        objectKey: document.objectKey,
        maxBytes: getMarketingEnvironment().MARKETING_MAX_DOCUMENT_BYTES,
      });
      const extracted = await extractStoredDocument({
        bytes: stored.bytes,
        contentType,
      });
      if (extracted.characterCount === 0) throw new Error("EMPTY_DOCUMENT");
      await markDocumentReady({
        ...input,
        sizeBytes: stored.sizeBytes,
        extracted,
        chunks: extracted.chunks,
      });
      return { status: "ready" as const, chunkCount: extracted.chunks.length };
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      const passwordProtected = message.includes("password");
      await markDocumentFailed({
        ...input,
        category: passwordProtected
          ? "password_protected"
          : "extraction_failed",
        message: passwordProtected
          ? "Password-protected documents are not supported. Remove the password and upload again."
          : "That document could not be read. Check that it is not malformed, then try again.",
      });
      logger.error("Knowledge document extraction failed.", {
        documentId: input.documentId,
        category: passwordProtected
          ? "password_protected"
          : "extraction_failed",
      });
      return { status: "failed" as const };
    }
  },
});
