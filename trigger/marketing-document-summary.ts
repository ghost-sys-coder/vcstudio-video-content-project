import { logger, task } from "@trigger.dev/sdk";
import { z } from "zod";
import {
  applyDocumentChunkSummary,
  applyDocumentSummary,
} from "@/db/commands/marketing-document-commands";
import {
  failMarketingRun,
  markMarketingRunRunning,
  reconcileMarketingUsage,
} from "@/db/commands/marketing-usage-commands";
import {
  findKnowledgeDocument,
  listKnowledgeDocumentChunksForDocument,
} from "@/db/repositories/marketing-documents.repository";
import {
  MARKETING_DOCUMENT_SUMMARY_PROMPT_VERSION,
  renderMarketingDocumentSummaryPrompt,
  renderMarketingDocumentSynthesisPrompt,
} from "@studio/prompts";
import { MARKETING_DOCUMENT_KEY_FACT_COUNT } from "@/lib/schemas/marketing-document-summary";
import { findMarketingRun } from "@/db/repositories/marketing-usage.repository";
import { calculateTextCostCents } from "@/lib/costs/scene-analysis-cost";
import { reconcileMarketingCost } from "@/lib/costs/marketing-cost";
import { createRequestFingerprint } from "@/lib/domain/idempotency";
import { getSceneAnalysisEnvironment } from "@/lib/env/server";
import { resolveMarketingAccess } from "@/lib/marketing/marketing-access";
import { classifyMarketingProviderError } from "@/lib/marketing/marketing-provider-error";
import { OpenAiTextGenerationProvider } from "@/lib/openai/openai-text-generation-provider";

export const marketingDocumentSummaryPayloadSchema = z.object({
  runId: z.uuid(),
  workspaceId: z.uuid(),
  documentId: z.uuid(),
});

export const marketingDocumentSummaryTask = task({
  id: "marketing-document-summary",
  queue: { name: "ai-text", concurrencyLimit: 2 },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 30000,
    factor: 2,
    randomize: true,
  },
  maxDuration: 180,
  run: async (
    payload: z.infer<typeof marketingDocumentSummaryPayloadSchema>,
    { ctx },
  ) => {
    const input = marketingDocumentSummaryPayloadSchema.parse(payload);
    const record = await findMarketingRun({
      workspaceId: input.workspaceId,
      runId: input.runId,
    });
    if (!record) throw new Error("Marketing run not found.");

    const { run, reservation } = record;
    if (
      run.status === "succeeded" ||
      run.status === "failed" ||
      run.status === "cancelled"
    )
      return { runId: run.id, status: run.status };

    const environment = getSceneAnalysisEnvironment();

    // Preflight: never call a billable provider unless the reservation that paid
    // for this call is still pending, unexpired, covers the estimate, and the
    // prompt about to be sent is the prompt that was priced.
    const expectedFingerprint = createRequestFingerprint(
      environment.REQUEST_FINGERPRINT_SECRET,
      run.finalPrompt,
    );
    if (
      reservation.status !== "pending" ||
      reservation.expiresAt.getTime() < Date.now() ||
      reservation.reservedCostCents !== run.estimatedCostCents ||
      run.requestFingerprint !== expectedFingerprint
    ) {
      await failMarketingRun({
        workspaceId: input.workspaceId,
        runId: run.id,
        reservationId: reservation.id,
        operation: run.operation,
        category: "preflight_failed",
        message:
          "The reservation for this summary was no longer valid. Ask for it again to retry.",
        chargedCostCents: 0,
      });
      return { runId: run.id, status: "failed" as const };
    }

    // Both switches are re-checked here as well as in the web action, because a
    // run queued while the studio was on would otherwise still reach a paid
    // provider after it was turned off — by a redeploy or by an owner flipping
    // the workspace toggle. A switch honoured in only one runtime is not a
    // switch. The reservation is released: nothing was spent.
    const access = await resolveMarketingAccess({
      workspaceId: input.workspaceId,
    });
    if (!access.available) {
      await failMarketingRun({
        workspaceId: input.workspaceId,
        runId: run.id,
        reservationId: reservation.id,
        operation: run.operation,
        category: "marketing_studio_disabled",
        message: "The Marketing Studio was switched off before this ran.",
        chargedCostCents: 0,
      });
      return { runId: run.id, status: "failed" as const };
    }

    // Read the document now rather than trusting the payload: it may have been
    // deleted or re-uploaded between queueing and running, and a summary written
    // against text that no longer exists is worse than no summary.
    const document = await findKnowledgeDocument({
      workspaceId: input.workspaceId,
      documentId: input.documentId,
    });
    if (!document || document.deletedAt !== null) {
      await failMarketingRun({
        workspaceId: input.workspaceId,
        runId: run.id,
        reservationId: reservation.id,
        operation: run.operation,
        category: "document_unavailable",
        message: "The document was removed before it could be summarised.",
        chargedCostCents: 0,
      });
      return { runId: run.id, status: "failed" as const };
    }

    await markMarketingRunRunning({
      workspaceId: input.workspaceId,
      runId: run.id,
      attemptCount: ctx.attempt.number,
    });

    try {
      const provider = new OpenAiTextGenerationProvider();
      const chunks = await listKnowledgeDocumentChunksForDocument({
        workspaceId: input.workspaceId,
        documentId: document.id,
      });
      if (chunks.length === 0) throw new Error("DOCUMENT_CHUNKS_MISSING");
      let inputTokens = 0;
      let outputTokens = 0;
      const requestIds: string[] = [];
      const chunkSummaries = [];
      for (const chunk of chunks) {
        if (
          chunk.summaryVersion === MARKETING_DOCUMENT_SUMMARY_PROMPT_VERSION &&
          chunk.summary !== ""
        ) {
          inputTokens += chunk.inputTokens;
          outputTokens += chunk.outputTokens;
          if (chunk.providerRequestId) requestIds.push(chunk.providerRequestId);
          chunkSummaries.push({
            label: chunk.sourceLocation.label,
            summary: chunk.summary,
            keyFacts: chunk.keyFacts,
          });
          continue;
        }
        const chunkResult = await provider.summariseDocument({
          model: run.model,
          prompt: renderMarketingDocumentSummaryPrompt({
            title: `${document.title} — ${chunk.sourceLocation.label}`,
            text: chunk.text,
            keyFactCount: MARKETING_DOCUMENT_KEY_FACT_COUNT,
          }),
        });
        inputTokens += chunkResult.inputTokens;
        outputTokens += chunkResult.outputTokens;
        requestIds.push(chunkResult.requestId);
        await applyDocumentChunkSummary({
          workspaceId: input.workspaceId,
          documentId: document.id,
          chunkId: chunk.id,
          checksum: chunk.checksum,
          summary: chunkResult.output.summary,
          keyFacts: chunkResult.output.keyFacts,
          summaryVersion: MARKETING_DOCUMENT_SUMMARY_PROMPT_VERSION,
          providerRequestId: chunkResult.requestId,
          inputTokens: chunkResult.inputTokens,
          outputTokens: chunkResult.outputTokens,
        });
        chunkSummaries.push({
          label: chunk.sourceLocation.label,
          summary: chunkResult.output.summary,
          keyFacts: chunkResult.output.keyFacts,
        });
      }
      const result =
        document.summaryVersion === MARKETING_DOCUMENT_SUMMARY_PROMPT_VERSION &&
        document.summary !== "" &&
        document.summaryProviderRequestId
          ? {
              output: {
                summary: document.summary,
                keyFacts: document.keyFacts,
                documentType: "other" as const,
              },
              requestId: document.summaryProviderRequestId,
              inputTokens: document.summaryInputTokens,
              outputTokens: document.summaryOutputTokens,
            }
          : await provider.summariseDocument({
              model: run.model,
              prompt: renderMarketingDocumentSynthesisPrompt({
                title: document.title,
                chunkSummaries,
                keyFactCount: MARKETING_DOCUMENT_KEY_FACT_COUNT,
              }),
            });
      inputTokens += result.inputTokens;
      outputTokens += result.outputTokens;
      requestIds.push(result.requestId);

      const actualCostCents = calculateTextCostCents({
        inputTokens,
        outputTokens,
        inputCostPerMillionCents:
          environment.OPENAI_TEXT_INPUT_COST_PER_MILLION_CENTS,
        outputCostPerMillionCents:
          environment.OPENAI_TEXT_OUTPUT_COST_PER_MILLION_CENTS,
      });
      const reconciliation = reconcileMarketingCost({
        reservedCostCents: reservation.reservedCostCents,
        actualCostCents,
      });

      // Checksum-scoped: if the document changed underneath us the summary is
      // dropped. The spend still reconciles — the tokens were genuinely burned.
      const applied = await applyDocumentSummary({
        workspaceId: input.workspaceId,
        documentId: document.id,
        checksum: document.checksum,
        summary: result.output.summary,
        keyFacts: result.output.keyFacts,
        summaryVersion: MARKETING_DOCUMENT_SUMMARY_PROMPT_VERSION,
        providerRequestId: result.requestId,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });
      if (!applied)
        logger.warn("Document changed during summarisation; summary dropped.", {
          runId: run.id,
          documentId: document.id,
        });

      await reconcileMarketingUsage({
        workspaceId: input.workspaceId,
        runId: run.id,
        reservationId: reservation.id,
        operation: run.operation,
        actualCostCents: reconciliation.chargedCostCents,
        inputTokens,
        outputTokens,
        providerRequestId: requestIds.at(-1) ?? result.requestId,
        safeMetadata: {
          documentId: document.id,
          documentType: result.output.documentType,
          keyFactCount: result.output.keyFacts.length,
          costBasis: reconciliation.costBasis,
          summaryApplied: applied,
          chunkCount: chunks.length,
          providerRequestCount: requestIds.length,
          providerRequestIds: requestIds,
        },
      });

      return { runId: run.id, status: "succeeded" as const };
    } catch (error) {
      const failure = classifyMarketingProviderError(error);
      if (
        !failure.retriable ||
        ctx.attempt.number >= (ctx.run.maxAttempts ?? 3)
      ) {
        logger.error("Marketing document summary failed.", {
          runId: run.id,
          category: failure.category,
        });
        await failMarketingRun({
          workspaceId: input.workspaceId,
          runId: run.id,
          reservationId: reservation.id,
          operation: run.operation,
          category: failure.category,
          message: failure.message,
          chargedCostCents: failure.mayHaveBilled
            ? reservation.reservedCostCents
            : 0,
        });
        return { runId: run.id, status: "failed" as const };
      }
      throw error;
    }
  },
});
