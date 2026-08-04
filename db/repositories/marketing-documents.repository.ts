import "server-only";

import { and, asc, count, desc, eq, isNull } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingBrandAssets,
  marketingKnowledgeDocuments,
  mediaAssets,
  type MarketingBrandAsset,
  type MarketingKnowledgeDocument,
  type MediaAsset,
} from "@/db/schema";

export const MARKETING_DOCUMENT_PAGE_SIZE = 100;

export async function listKnowledgeDocuments(input: {
  workspaceId: string;
}): Promise<MarketingKnowledgeDocument[]> {
  return getDatabase()
    .select()
    .from(marketingKnowledgeDocuments)
    .where(
      and(
        eq(marketingKnowledgeDocuments.workspaceId, input.workspaceId),
        isNull(marketingKnowledgeDocuments.deletedAt),
      ),
    )
    .orderBy(
      desc(marketingKnowledgeDocuments.priority),
      desc(marketingKnowledgeDocuments.createdAt),
    )
    .limit(MARKETING_DOCUMENT_PAGE_SIZE);
}

export async function countKnowledgeDocuments(input: {
  workspaceId: string;
}): Promise<number> {
  const [row] = await getDatabase()
    .select({ value: count() })
    .from(marketingKnowledgeDocuments)
    .where(
      and(
        eq(marketingKnowledgeDocuments.workspaceId, input.workspaceId),
        isNull(marketingKnowledgeDocuments.deletedAt),
      ),
    );
  return row?.value ?? 0;
}

export async function findKnowledgeDocument(input: {
  workspaceId: string;
  documentId: string;
}): Promise<MarketingKnowledgeDocument | null> {
  const [document] = await getDatabase()
    .select()
    .from(marketingKnowledgeDocuments)
    .where(
      and(
        eq(marketingKnowledgeDocuments.id, input.documentId),
        eq(marketingKnowledgeDocuments.workspaceId, input.workspaceId),
      ),
    )
    .limit(1);
  return document ?? null;
}

export type BrandAssetWithMedia = {
  brandAsset: MarketingBrandAsset;
  media: MediaAsset;
};

export async function listBrandAssets(input: {
  workspaceId: string;
}): Promise<BrandAssetWithMedia[]> {
  const rows = await getDatabase()
    .select({ brandAsset: marketingBrandAssets, media: mediaAssets })
    .from(marketingBrandAssets)
    .innerJoin(
      mediaAssets,
      eq(mediaAssets.id, marketingBrandAssets.mediaAssetId),
    )
    .where(eq(marketingBrandAssets.workspaceId, input.workspaceId))
    .orderBy(
      asc(marketingBrandAssets.role),
      asc(marketingBrandAssets.position),
      asc(marketingBrandAssets.createdAt),
    );
  return rows;
}
