import "server-only";

import {
  countKnowledgeDocuments,
  listBrandAssets,
  listKnowledgeDocuments,
} from "@/db/repositories/marketing-documents.repository";
import type {
  MarketingBrandAssetRole,
  MarketingDocumentStatus,
} from "@/db/schema";
import { getMarketingEnvironment } from "@/lib/env/server";
import { createMediaAssetDownloadUrl } from "@/lib/storage/media-asset-storage";

export type KnowledgeDocumentView = {
  id: string;
  title: string;
  status: MarketingDocumentStatus;
  sourceKind: string;
  originalFileName: string;
  characterCount: number;
  tokenEstimate: number;
  includeInContext: boolean;
  priority: number;
  hasSummary: boolean;
  summary: string;
  keyFacts: string[];
  safeErrorMessage: string | null;
  createdAt: string;
};

export type BrandAssetView = {
  id: string;
  mediaAssetId: string;
  role: MarketingBrandAssetRole;
  notes: string;
  title: string;
  previewUrl: string;
  kind: "image" | "video";
};

export type MarketingAssetsView = {
  documents: KnowledgeDocumentView[];
  documentCount: number;
  maxDocuments: number;
  includedTokenEstimate: number;
  brandAssets: BrandAssetView[];
};

/**
 * Everything the Assets tabs need.
 *
 * `includedTokenEstimate` is the number that matters: it is what the compiled
 * brand context will have to fit, and showing it here is what stops a user
 * discovering the ceiling only when their pricing sheet is silently truncated
 * out of a prompt.
 */
export async function loadMarketingAssetsView(input: {
  workspaceId: string;
}): Promise<MarketingAssetsView> {
  const environment = getMarketingEnvironment();
  const [documents, documentCount, brandAssets] = await Promise.all([
    listKnowledgeDocuments({ workspaceId: input.workspaceId }),
    countKnowledgeDocuments({ workspaceId: input.workspaceId }),
    listBrandAssets({ workspaceId: input.workspaceId }),
  ]);

  const assetViews = await Promise.all(
    brandAssets.map(async (row) => ({
      id: row.brandAsset.id,
      mediaAssetId: row.brandAsset.mediaAssetId,
      role: row.brandAsset.role,
      notes: row.brandAsset.notes,
      title: row.media.title ?? row.media.originalFileName,
      previewUrl: await createMediaAssetDownloadUrl(row.media.objectKey),
      kind: row.media.kind,
    })),
  );

  return {
    documents: documents.map((document) => ({
      id: document.id,
      title: document.title,
      status: document.status,
      sourceKind: document.sourceKind,
      originalFileName: document.originalFileName,
      characterCount: document.extractedCharacterCount,
      tokenEstimate: document.tokenEstimate,
      includeInContext: document.includeInContext,
      priority: document.priority,
      hasSummary: document.summary !== "",
      summary: document.summary,
      keyFacts: document.keyFacts,
      safeErrorMessage: document.safeErrorMessage,
      createdAt: document.createdAt.toISOString(),
    })),
    documentCount,
    maxDocuments: environment.MARKETING_MAX_DOCUMENTS,
    includedTokenEstimate: documents
      .filter(
        (document) => document.includeInContext && document.status === "ready",
      )
      .reduce((total, document) => total + document.tokenEstimate, 0),
    brandAssets: assetViews,
  };
}
