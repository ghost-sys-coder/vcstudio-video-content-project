import "server-only";

import { and, asc, count, desc, eq, isNull, sql } from "drizzle-orm";
import { getDatabase } from "@/db/drizzle";
import {
  marketingBrandAssets,
  marketingKnowledgeDocuments,
  marketingKnowledgeDocumentChunks,
  mediaAssets,
  type MarketingBrandAsset,
  type MarketingKnowledgeDocument,
  type MediaAsset,
} from "@/db/schema";

export async function listKnowledgeDocumentChunks(input: {
  workspaceId: string;
}) {
  return getDatabase()
    .select()
    .from(marketingKnowledgeDocumentChunks)
    .where(eq(marketingKnowledgeDocumentChunks.workspaceId, input.workspaceId))
    .orderBy(
      asc(marketingKnowledgeDocumentChunks.documentId),
      asc(marketingKnowledgeDocumentChunks.chunkIndex),
    )
    .limit(2_000);
}

export async function listKnowledgeDocumentChunksForDocument(input: {
  workspaceId: string;
  documentId: string;
}) {
  return getDatabase()
    .select()
    .from(marketingKnowledgeDocumentChunks)
    .where(
      and(
        eq(marketingKnowledgeDocumentChunks.workspaceId, input.workspaceId),
        eq(marketingKnowledgeDocumentChunks.documentId, input.documentId),
      ),
    )
    .orderBy(asc(marketingKnowledgeDocumentChunks.chunkIndex))
    .limit(100);
}

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

export type KnowledgeSearchHit = {
  documentId: string;
  title: string;
  /** A `ts_headline` extract, not the whole document. Untrusted text. */
  passage: string;
  rank: number;
};

/**
 * Full-text search over the workspace's documents.
 *
 * `websearch_to_tsquery` rather than `to_tsquery` because the query string
 * arrives from a language model: `to_tsquery` raises a syntax error on anything
 * that is not already a tsquery expression, and a tool that throws on ordinary
 * phrasing is a tool the model learns to stop calling. `websearch_to_tsquery`
 * accepts what a person would type and never errors.
 *
 * The `to_tsvector('english', extracted_text)` expression is written to match
 * `marketing_knowledge_documents_fts_index` exactly; any divergence — a
 * different configuration name, a cast, a coalesce — silently drops the index
 * and turns this into a sequential scan of every document in the table.
 *
 * Documents excluded from the always-on context block are still searchable.
 * That flag is a token-budget control, not a permission: excluding a large
 * document from every prompt is precisely the case retrieval exists to serve.
 */
export async function searchKnowledgeDocuments(input: {
  workspaceId: string;
  query: string;
  limit: number;
}): Promise<KnowledgeSearchHit[]> {
  const result = await getDatabase().execute<{
    document_id: string;
    title: string;
    passage: string;
    rank: number;
  }>(sql`
    select
      documents.id as document_id,
      documents.title as title,
      ts_headline(
        'english',
        documents.extracted_text,
        search.query,
        'MaxFragments=2, MinWords=12, MaxWords=40, FragmentDelimiter=" … ", StartSel="", StopSel=""'
      ) as passage,
      ts_rank(to_tsvector('english', documents.extracted_text), search.query) as rank
    from ${marketingKnowledgeDocuments} as documents,
      websearch_to_tsquery('english', ${input.query}) as search(query)
    where documents.workspace_id = ${input.workspaceId}
      and documents.deleted_at is null
      and documents.status = 'ready'
      and to_tsvector('english', documents.extracted_text) @@ search.query
    order by rank desc, documents.priority desc, documents.created_at asc
    limit ${input.limit}
  `);

  return result.rows.map((row) => ({
    documentId: row.document_id,
    title: row.title,
    passage: row.passage,
    rank: Number(row.rank),
  }));
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
