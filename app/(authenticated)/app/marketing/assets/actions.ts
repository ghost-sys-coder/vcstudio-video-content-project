"use server";

import { revalidatePath } from "next/cache";
import {
  assignBrandAssetRole,
  createPastedDocument,
  removeBrandAsset,
  softDeleteDocument,
  updateDocumentDetails,
} from "@/db/commands/marketing-document-commands";
import { findReadyMediaAssets } from "@/db/repositories/media-assets.repository";
import { findKnowledgeDocument } from "@/db/repositories/marketing-documents.repository";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { resolveMarketingAccess } from "@/lib/marketing/marketing-access";
import {
  MarketingBudgetExceededError,
  RateLimitExceededError,
  WorkspacePermissionDeniedError,
} from "@/lib/domain/errors";
import { extractDocumentText } from "@/lib/marketing/documents/extract-text";
import { chunkDocumentSections } from "@/lib/marketing/documents/chunk-document";
import { startDocumentExtraction } from "@/lib/marketing/documents/start-document-extraction";
import {
  MarketingDocumentSummaryRequestError,
  startDocumentSummary,
} from "@/lib/marketing/documents/start-document-summary";
import { requireCapability } from "@/lib/policies/workspace-policy";
import {
  assignBrandAssetSchema,
  removeBrandAssetSchema,
} from "@/lib/schemas/marketing-brand-asset";
import {
  deleteDocumentSchema,
  pasteDocumentSchema,
  readUpdateDocumentForm,
  reprocessDocumentSchema,
  summariseDocumentSchema,
  updateDocumentSchema,
} from "@/lib/schemas/marketing-document";
import { deleteDocumentObject } from "@/lib/storage/marketing-document-storage";

export type AssetsActionResult = { ok: true } | { ok: false; error: string };

async function resolveContext() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context)
    return { ok: false as const, error: "Workspace context is unavailable." };

  requireCapability(context.activeMembership.role, "manageBrandProfile");

  // Checked after membership is known, because the workspace switch is
  // per-workspace: there is no access question to answer until we know which
  // workspace is asking.
  const access = await resolveMarketingAccess({
    workspaceId: context.activeMembership.workspaceId,
  });
  if (!access.available)
    return {
      ok: false as const,
      error:
        access.reason === "deployment_disabled"
          ? "The Marketing Studio is not enabled."
          : "The Marketing Studio is switched off for this workspace.",
    };

  return {
    ok: true as const,
    workspaceId: context.activeMembership.workspaceId,
    userId: context.user.id,
  };
}

function revalidateAssets(): void {
  revalidatePath("/app/marketing");
  revalidatePath("/app/marketing/assets");
  revalidatePath("/app/marketing/assets/documents");
}

function toFailure(error: unknown, fallback: string): AssetsActionResult {
  if (error instanceof WorkspacePermissionDeniedError)
    return { ok: false, error: "You do not have permission to do that." };
  return { ok: false, error: fallback };
}

export async function pasteDocumentAction(
  formData: FormData,
): Promise<AssetsActionResult> {
  const parsed = pasteDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That text is not valid.",
    };

  try {
    const context = await resolveContext();
    if (!context.ok) return context;

    const extracted = extractDocumentText({
      bytes: new TextEncoder().encode(parsed.data.body),
      contentType: "text/plain",
    });
    if (extracted.characterCount === 0)
      return { ok: false, error: "That text contained nothing readable." };

    await createPastedDocument({
      workspaceId: context.workspaceId,
      title: parsed.data.title,
      extracted,
      createdByUserId: context.userId,
      chunks: chunkDocumentSections([
        {
          text: extracted.text,
          sourceLocation: {
            kind: "text",
            start: 1,
            end: 1,
            label: "Pasted text",
          },
        },
      ]),
    });

    revalidateAssets();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "That text could not be saved.");
  }
}

export async function reprocessDocumentAction(
  formData: FormData,
): Promise<AssetsActionResult> {
  const parsed = reprocessDocumentSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { ok: false, error: "That document could not be reprocessed." };
  try {
    const context = await resolveContext();
    if (!context.ok) return context;
    const document = await findKnowledgeDocument({
      workspaceId: context.workspaceId,
      documentId: parsed.data.documentId,
    });
    if (!document || document.deletedAt || !document.objectKey)
      return { ok: false, error: "That uploaded document no longer exists." };
    await startDocumentExtraction({
      workspaceId: context.workspaceId,
      documentId: parsed.data.documentId,
      force: true,
    });
    revalidateAssets();
    return { ok: true };
  } catch (error) {
    return toFailure(
      error,
      "That document could not be queued for reprocessing.",
    );
  }
}

export async function updateDocumentAction(
  formData: FormData,
): Promise<AssetsActionResult> {
  const parsed = updateDocumentSchema.safeParse(
    readUpdateDocumentForm(formData),
  );
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That document is not valid.",
    };

  try {
    const context = await resolveContext();
    if (!context.ok) return context;

    await updateDocumentDetails({
      workspaceId: context.workspaceId,
      documentId: parsed.data.documentId,
      title: parsed.data.title,
      includeInContext: parsed.data.includeInContext,
      priority: parsed.data.priority,
      freshForDays: parsed.data.freshForDays,
    });

    revalidateAssets();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "That document could not be updated.");
  }
}

export async function deleteDocumentAction(
  formData: FormData,
): Promise<AssetsActionResult> {
  const parsed = deleteDocumentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: "That document could not be removed." };

  try {
    const context = await resolveContext();
    if (!context.ok) return context;

    const removed = await softDeleteDocument({
      workspaceId: context.workspaceId,
      documentId: parsed.data.documentId,
    });
    if (!removed)
      return { ok: false, error: "That document no longer exists." };

    // The row survives so a past generation stays explainable; the bytes do
    // not, because the workspace should stop paying to store withdrawn text.
    if (removed.objectKey)
      await deleteDocumentObject(removed.objectKey).catch(() => undefined);

    revalidateAssets();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "That document could not be removed.");
  }
}

const BUDGET_REFUSALS: Record<string, string> = {
  workspace_daily:
    "This would pass the workspace's daily budget. Raise it in Usage & budgets, or try again tomorrow.",
  workspace_monthly:
    "This would pass the workspace's monthly budget. Raise it in Usage & budgets.",
  marketing_monthly:
    "This would pass the marketing monthly cap. Raise it in Marketing settings.",
  schedule_rule: "This would pass the schedule's own spending cap.",
};

/**
 * Queues a summary for one document. The first billable marketing action.
 *
 * Budget and rate-limit refusals are reported distinctly rather than folded
 * into a generic failure: "this would pass your daily budget" tells the user
 * what to change, and "that could not be summarised" does not.
 */
export async function summariseDocumentAction(
  formData: FormData,
): Promise<AssetsActionResult> {
  const parsed = summariseDocumentSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success)
    return { ok: false, error: "That document could not be summarised." };

  try {
    const context = await resolveContext();
    if (!context.ok) return context;

    await startDocumentSummary({
      workspaceId: context.workspaceId,
      documentId: parsed.data.documentId,
      requestedByUserId: context.userId,
    });

    revalidateAssets();
    return { ok: true };
  } catch (error) {
    if (error instanceof MarketingBudgetExceededError)
      return {
        ok: false,
        error: BUDGET_REFUSALS[error.scope] ?? error.message,
      };
    if (error instanceof RateLimitExceededError)
      return { ok: false, error: error.message };
    if (error instanceof MarketingDocumentSummaryRequestError)
      return { ok: false, error: error.message };
    return toFailure(error, "That document could not be summarised.");
  }
}

export async function assignBrandAssetAction(
  formData: FormData,
): Promise<AssetsActionResult> {
  const parsed = assignBrandAssetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That asset is not valid.",
    };

  try {
    const context = await resolveContext();
    if (!context.ok) return context;

    // The composite tenant FK would reject a foreign asset, but checking here
    // turns a constraint violation into an honest message.
    const [asset] = await findReadyMediaAssets({
      workspaceId: context.workspaceId,
      mediaAssetIds: [parsed.data.mediaAssetId],
    });
    if (!asset)
      return {
        ok: false,
        error: "That file is not available in this workspace.",
      };

    await assignBrandAssetRole({
      workspaceId: context.workspaceId,
      mediaAssetId: parsed.data.mediaAssetId,
      role: parsed.data.role,
      notes: parsed.data.notes,
    });

    revalidateAssets();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "That asset could not be assigned.");
  }
}

export async function removeBrandAssetAction(
  formData: FormData,
): Promise<AssetsActionResult> {
  const parsed = removeBrandAssetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success)
    return { ok: false, error: "That asset could not be removed." };

  try {
    const context = await resolveContext();
    if (!context.ok) return context;

    await removeBrandAsset({
      workspaceId: context.workspaceId,
      brandAssetId: parsed.data.brandAssetId,
    });

    revalidateAssets();
    return { ok: true };
  } catch (error) {
    return toFailure(error, "That asset could not be removed.");
  }
}
