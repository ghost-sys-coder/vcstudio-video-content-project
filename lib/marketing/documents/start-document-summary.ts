import "server-only";

import { tasks } from "@trigger.dev/sdk";
import {
  MARKETING_DOCUMENT_SUMMARY_PROMPT_VERSION,
  renderMarketingDocumentSummaryPrompt,
} from "@studio/prompts";
import {
  attachMarketingTriggerRun,
  failMarketingRun,
} from "@/db/commands/marketing-usage-commands";
import { findKnowledgeDocument } from "@/db/repositories/marketing-documents.repository";
import {
  estimateMarketingTextCost,
  MARKETING_EXPECTED_OUTPUT_TOKENS,
} from "@/lib/costs/marketing-cost";
import {
  createMarketingOperationIdempotencyKey,
  createRequestFingerprint,
} from "@/lib/domain/idempotency";
import {
  getMarketingEnvironment,
  getSceneAnalysisEnvironment,
} from "@/lib/env/server";
import { reserveMarketingUsage } from "@/lib/marketing/usage/reserve-marketing-usage";
import { enforceRateLimit } from "@/lib/rate-limit/enforce-rate-limit";
import { MARKETING_DOCUMENT_KEY_FACT_COUNT } from "@/lib/schemas/marketing-document-summary";
import type { marketingDocumentSummaryTask } from "@/trigger/marketing-document-summary";

export class MarketingDocumentSummaryRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarketingDocumentSummaryRequestError";
  }
}

/**
 * The first billable operation in the Marketing Studio, and the reason the
 * ledger exists before any of the interesting features do.
 *
 * Deliberately shaped like `startThumbnailGeneration`: render the prompt, price
 * it, reserve against the budget, only then queue the work. What differs is that
 * the reservation is a single call — `reserveMarketingUsage` owns the advisory
 * lock, the combined-ledger read, and every ceiling — so no caller can assemble
 * a budget check incorrectly.
 */
export async function startDocumentSummary(input: {
  workspaceId: string;
  documentId: string;
  requestedByUserId: string;
}): Promise<{ runId: string; created: boolean }> {
  const marketingEnvironment = getMarketingEnvironment();
  if (!marketingEnvironment.ENABLE_MARKETING_STUDIO)
    throw new MarketingDocumentSummaryRequestError(
      "The Marketing Studio is disabled.",
    );

  const document = await findKnowledgeDocument({
    workspaceId: input.workspaceId,
    documentId: input.documentId,
  });
  if (!document || document.deletedAt !== null)
    throw new MarketingDocumentSummaryRequestError("Document not found.");
  if (document.status !== "ready")
    throw new MarketingDocumentSummaryRequestError(
      "This document has not finished processing yet.",
    );
  if (document.extractedText.trim() === "")
    throw new MarketingDocumentSummaryRequestError(
      "This document has no readable text to summarise.",
    );

  await enforceRateLimit({
    workspaceId: input.workspaceId,
    operation: "marketing_content_generation",
  });

  const textEnvironment = getSceneAnalysisEnvironment();
  const model = textEnvironment.OPENAI_TEXT_MODEL;
  const finalPrompt = renderMarketingDocumentSummaryPrompt({
    title: document.title,
    text: document.extractedText,
    keyFactCount: MARKETING_DOCUMENT_KEY_FACT_COUNT,
  });

  const estimatedCostCents = estimateMarketingTextCost({
    prompt: finalPrompt,
    expectedOutputTokens: MARKETING_EXPECTED_OUTPUT_TOKENS.document_summary,
    rates: {
      inputCostPerMillionCents:
        textEnvironment.OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS,
      outputCostPerMillionCents:
        textEnvironment.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS,
    },
  });

  // Keyed on the checksum of the extracted text, so re-uploading the same file
  // or asking twice costs nothing, while genuinely edited text is new work.
  const idempotencyKey = createMarketingOperationIdempotencyKey({
    secret: textEnvironment.IDEMPOTENCY_HASH_SECRET,
    workspaceId: input.workspaceId,
    operation: "document_summary",
    subjectId: document.id,
    subjectFingerprint: document.checksum,
    model,
    promptVersion: MARKETING_DOCUMENT_SUMMARY_PROMPT_VERSION,
  });

  const reservation = await reserveMarketingUsage({
    workspaceId: input.workspaceId,
    operation: "document_summary",
    estimatedCostCents,
    idempotencyKey,
    requestedByUserId: input.requestedByUserId,
    model,
    promptVersion: MARKETING_DOCUMENT_SUMMARY_PROMPT_VERSION,
    finalPrompt,
    requestFingerprint: createRequestFingerprint(
      textEnvironment.REQUEST_FINGERPRINT_SECRET,
      finalPrompt,
    ),
    subjectKind: "knowledge_document",
    subjectId: document.id,
  });
  if (!reservation.created) return { runId: reservation.runId, created: false };

  try {
    const handle = await tasks.trigger<typeof marketingDocumentSummaryTask>(
      "marketing-document-summary",
      {
        runId: reservation.runId,
        workspaceId: input.workspaceId,
        documentId: document.id,
      },
      { idempotencyKey },
    );
    await attachMarketingTriggerRun({
      workspaceId: input.workspaceId,
      runId: reservation.runId,
      triggerRunId: handle.id,
    });
  } catch (error) {
    // Release the reservation: nothing reached a provider, so this spend is not
    // real and must not sit committed against the workspace's daily budget.
    await failMarketingRun({
      workspaceId: input.workspaceId,
      runId: reservation.runId,
      reservationId: reservation.reservationId,
      operation: "document_summary",
      category: "trigger_error",
      message: "The summary could not be queued. Try again.",
      chargedCostCents: 0,
    });
    throw error;
  }

  return { runId: reservation.runId, created: true };
}
