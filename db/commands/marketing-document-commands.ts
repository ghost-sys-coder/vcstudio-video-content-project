import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingBrandAssets,
  marketingBrandProfiles,
  marketingKnowledgeDocuments,
  type MarketingBrandAssetRole,
  type MarketingKnowledgeDocument,
} from "@/db/schema";
import type { ExtractedDocument } from "@/lib/marketing/documents/extract-text";

/**
 * Any change to what the studio knows bumps the profile's context version, so a
 * past generation stays explainable after the corpus has moved on. Best-effort:
 * a workspace with no profile row yet simply has nothing to bump.
 */
async function bumpContextVersion(workspaceId: string): Promise<void> {
  await getDatabase()
    .update(marketingBrandProfiles)
    .set({
      contextVersion: sql`${marketingBrandProfiles.contextVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(marketingBrandProfiles.workspaceId, workspaceId));
}

export async function createPendingDocument(input: {
  id: string;
  workspaceId: string;
  title: string;
  contentType: string;
  sizeBytes: number;
  originalFileName: string;
  objectKey: string;
  createdByUserId: string;
}): Promise<void> {
  await getDatabase().insert(marketingKnowledgeDocuments).values({
    id: input.id,
    workspaceId: input.workspaceId,
    title: input.title,
    sourceKind: "upload",
    objectKey: input.objectKey,
    contentType: input.contentType,
    sizeBytes: input.sizeBytes,
    originalFileName: input.originalFileName,
    status: "pending",
    createdByUserId: input.createdByUserId,
  });
}

export async function markDocumentReady(input: {
  workspaceId: string;
  documentId: string;
  sizeBytes: number;
  extracted: ExtractedDocument;
}): Promise<MarketingKnowledgeDocument | null> {
  const [document] = await getDatabase()
    .update(marketingKnowledgeDocuments)
    .set({
      status: "ready",
      sizeBytes: input.sizeBytes,
      extractedText: input.extracted.text,
      extractedCharacterCount: input.extracted.characterCount,
      tokenEstimate: input.extracted.tokenEstimate,
      checksum: input.extracted.checksum,
      errorCategory: null,
      safeErrorMessage: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingKnowledgeDocuments.id, input.documentId),
        eq(marketingKnowledgeDocuments.workspaceId, input.workspaceId),
      ),
    )
    .returning();

  if (document) await bumpContextVersion(input.workspaceId);
  return document ?? null;
}

export async function markDocumentFailed(input: {
  workspaceId: string;
  documentId: string;
  category: string;
  message: string;
}): Promise<void> {
  await getDatabase()
    .update(marketingKnowledgeDocuments)
    .set({
      status: "failed",
      errorCategory: input.category,
      safeErrorMessage: input.message,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingKnowledgeDocuments.id, input.documentId),
        eq(marketingKnowledgeDocuments.workspaceId, input.workspaceId),
      ),
    );
}

export async function createPastedDocument(input: {
  workspaceId: string;
  title: string;
  extracted: ExtractedDocument;
  createdByUserId: string;
}): Promise<MarketingKnowledgeDocument> {
  const [document] = await getDatabase()
    .insert(marketingKnowledgeDocuments)
    .values({
      workspaceId: input.workspaceId,
      title: input.title,
      sourceKind: "pasted",
      // Pasted text has no stored object; the source-object CHECK requires the
      // key to be null for exactly this case.
      objectKey: null,
      contentType: "text/plain",
      sizeBytes: input.extracted.characterCount,
      status: "ready",
      extractedText: input.extracted.text,
      extractedCharacterCount: input.extracted.characterCount,
      tokenEstimate: input.extracted.tokenEstimate,
      checksum: input.extracted.checksum,
      createdByUserId: input.createdByUserId,
    })
    .returning();

  if (!document) throw new Error("MARKETING_DOCUMENT_NOT_CREATED");
  await bumpContextVersion(input.workspaceId);
  return document;
}

/**
 * Writes a finished summary back onto the document.
 *
 * Scoped by checksum as well as by workspace and id: if the document was edited
 * or replaced while the summariser was running, the stale summary is dropped
 * rather than pinned onto text it does not describe. Returns whether it landed
 * so the caller can say which happened.
 */
export async function applyDocumentSummary(input: {
  workspaceId: string;
  documentId: string;
  checksum: string;
  summary: string;
  keyFacts: string[];
}): Promise<boolean> {
  const [document] = await getDatabase()
    .update(marketingKnowledgeDocuments)
    .set({
      summary: input.summary,
      keyFacts: input.keyFacts,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingKnowledgeDocuments.id, input.documentId),
        eq(marketingKnowledgeDocuments.workspaceId, input.workspaceId),
        eq(marketingKnowledgeDocuments.checksum, input.checksum),
      ),
    )
    .returning({ id: marketingKnowledgeDocuments.id });

  if (!document) return false;
  await bumpContextVersion(input.workspaceId);
  return true;
}

export async function updateDocumentDetails(input: {
  workspaceId: string;
  documentId: string;
  title: string;
  includeInContext: boolean;
  priority: number;
}): Promise<void> {
  await getDatabase()
    .update(marketingKnowledgeDocuments)
    .set({
      title: input.title,
      includeInContext: input.includeInContext,
      priority: input.priority,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingKnowledgeDocuments.id, input.documentId),
        eq(marketingKnowledgeDocuments.workspaceId, input.workspaceId),
      ),
    );
  await bumpContextVersion(input.workspaceId);
}

/**
 * Soft-deletes a document.
 *
 * The row survives so a past generation that cited it stays explainable, in the
 * same spirit as the media library's soft delete. The stored object is removed
 * separately by the caller — the workspace should stop paying to store text it
 * has withdrawn.
 */
export async function softDeleteDocument(input: {
  workspaceId: string;
  documentId: string;
}): Promise<{ objectKey: string | null } | null> {
  const [document] = await getDatabase()
    .update(marketingKnowledgeDocuments)
    .set({
      deletedAt: new Date(),
      includeInContext: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(marketingKnowledgeDocuments.id, input.documentId),
        eq(marketingKnowledgeDocuments.workspaceId, input.workspaceId),
      ),
    )
    .returning({ objectKey: marketingKnowledgeDocuments.objectKey });

  if (document) await bumpContextVersion(input.workspaceId);
  return document ?? null;
}

export async function assignBrandAssetRole(input: {
  workspaceId: string;
  mediaAssetId: string;
  role: MarketingBrandAssetRole;
  notes: string;
}): Promise<void> {
  const database = getDatabase();

  // The primary logo is unique per workspace; claiming it moves it off whoever
  // holds it, rather than failing the write the user just asked for.
  if (input.role === "logo_primary")
    await database
      .update(marketingBrandAssets)
      .set({ role: "logo_alt", updatedAt: new Date() })
      .where(
        and(
          eq(marketingBrandAssets.workspaceId, input.workspaceId),
          eq(marketingBrandAssets.role, "logo_primary"),
        ),
      );

  await database
    .insert(marketingBrandAssets)
    .values({
      workspaceId: input.workspaceId,
      mediaAssetId: input.mediaAssetId,
      role: input.role,
      notes: input.notes,
    })
    .onConflictDoUpdate({
      target: [
        marketingBrandAssets.workspaceId,
        marketingBrandAssets.mediaAssetId,
      ],
      set: { role: input.role, notes: input.notes, updatedAt: new Date() },
    });

  await bumpContextVersion(input.workspaceId);
}

export async function removeBrandAsset(input: {
  workspaceId: string;
  brandAssetId: string;
}): Promise<void> {
  await getDatabase()
    .delete(marketingBrandAssets)
    .where(
      and(
        eq(marketingBrandAssets.id, input.brandAssetId),
        eq(marketingBrandAssets.workspaceId, input.workspaceId),
      ),
    );
  await bumpContextVersion(input.workspaceId);
}
