import "server-only";

import { tasks } from "@trigger.dev/sdk";
import type { marketingDocumentExtractionTask } from "@/trigger/marketing-document-extraction";

export async function startDocumentExtraction(input: {
  workspaceId: string;
  documentId: string;
  force?: boolean;
}): Promise<void> {
  await tasks.trigger<typeof marketingDocumentExtractionTask>(
    "marketing-document-extraction",
    { workspaceId: input.workspaceId, documentId: input.documentId },
    {
      idempotencyKey: `knowledge-extraction-v2:${input.workspaceId}:${input.documentId}:${input.force ? crypto.randomUUID() : "initial"}`,
    },
  );
}
