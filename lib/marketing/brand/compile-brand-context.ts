import "server-only";

import { cache } from "react";
import {
  MARKETING_BRAND_CONTEXT_VERSION,
  renderBrandContextBlock,
  type BrandContextRender,
} from "@studio/prompts";
import { saveBrandContextSnapshot } from "@/db/commands/marketing-brand-context-commands";
import {
  findBrandProfile,
  listBrandAudiences,
  listBrandOffers,
} from "@/db/repositories/marketing-brand.repository";
import { listKnowledgeDocuments } from "@/db/repositories/marketing-documents.repository";
import { getMarketingEnvironment } from "@/lib/env/server";
import { createBrandContextFingerprint } from "@/lib/marketing/brand/brand-context-fingerprint";

export type CompiledBrandContext = BrandContextRender & {
  sourceFingerprint: string;
  promptVersion: string;
  contextVersion: number;
  /** Documents eligible for the block, in the order truncation considers them. */
  candidateDocuments: { id: string; title: string; tokenEstimate: number }[];
  hasProfile: boolean;
};

/**
 * Compiles the brand context block for a workspace.
 *
 * Wrapped in React `cache()` so a request that needs the block in several
 * places — the preview page, a generation prompt, a snapshot write — compiles
 * it once. The cache is per-request, so it never serves one workspace's context
 * to another.
 *
 * Documents arrive already ordered `priority desc, created_at asc` from the
 * repository, and that order is what truncation consumes: the least important
 * document is the first to be dropped. Only documents that are `ready` and
 * marked `include_in_context` are eligible, and only their **summaries and key
 * facts** are used — never `extracted_text`. That is a token-budget decision
 * and a prompt-injection decision at once: a model-written précis of a document
 * carrying "ignore previous instructions" is a précis, not obedience.
 */
export const compileBrandContext = cache(
  async (input: { workspaceId: string }): Promise<CompiledBrandContext> => {
    const maxTokens =
      getMarketingEnvironment().MARKETING_BRAND_CONTEXT_MAX_TOKENS;
    const profile = await findBrandProfile({ workspaceId: input.workspaceId });

    const [audiences, offers, documents] = await Promise.all([
      profile
        ? listBrandAudiences({
            workspaceId: input.workspaceId,
            brandProfileId: profile.id,
          })
        : Promise.resolve([]),
      profile
        ? listBrandOffers({
            workspaceId: input.workspaceId,
            brandProfileId: profile.id,
          })
        : Promise.resolve([]),
      listKnowledgeDocuments({ workspaceId: input.workspaceId }),
    ]);

    const eligibleDocuments = documents
      .filter(
        (document) =>
          document.includeInContext &&
          document.status === "ready" &&
          // A document with no summary yet contributes nothing but its title;
          // including it would spend budget on an empty section.
          (document.summary.trim() !== "" || document.keyFacts.length > 0),
      )
      // Re-sorted here rather than inherited from the repository, which orders
      // newest-first for the documents list. Truncation needs the opposite
      // tie-break: on equal priority the *older* document wins, so adding a new
      // document cannot silently displace an established one from the context.
      // Sorting explicitly also keeps this order a property of the compiler,
      // where the determinism guarantee lives, rather than of a shared query.
      .sort((left, right) => {
        if (left.priority !== right.priority)
          return right.priority - left.priority;
        return left.createdAt.getTime() - right.createdAt.getTime();
      });

    const render = renderBrandContextBlock({
      businessName: profile?.businessName ?? "",
      websiteUrl: profile?.websiteUrl ?? null,
      oneLiner: profile?.oneLiner ?? "",
      longDescription: profile?.longDescription ?? "",
      industry: profile?.industry ?? "",
      primaryLanguage: profile?.primaryLanguage ?? "English",
      valueProps: profile?.valueProps ?? [],
      proofPoints: profile?.proofPoints ?? [],
      audiences: audiences.map((audience) => ({
        name: audience.name,
        description: audience.description,
        painPoints: audience.painPoints,
        geography: audience.geography,
        buyingTriggers: audience.buyingTriggers,
        isPrimary: audience.isPrimary,
      })),
      offers: offers.map((offer) => ({
        name: offer.name,
        summary: offer.summary,
        priceModel: offer.priceModel,
        differentiators: offer.differentiators,
      })),
      brandVoiceSummary: profile?.brandVoiceSummary ?? "",
      toneAttributes: profile?.toneAttributes ?? [],
      writingRules: profile?.writingRules ?? [],
      bannedPhrases: profile?.bannedPhrases ?? [],
      complianceNotes: profile?.complianceNotes ?? "",
      documents: eligibleDocuments.map((document) => ({
        id: document.id,
        title: document.title,
        summary: document.summary,
        keyFacts: document.keyFacts,
      })),
      maxTokens,
    });

    const sourceFingerprint = createBrandContextFingerprint({
      promptVersion: MARKETING_BRAND_CONTEXT_VERSION,
      maxTokens,
      profile: {
        businessName: profile?.businessName ?? "",
        websiteUrl: profile?.websiteUrl ?? null,
        oneLiner: profile?.oneLiner ?? "",
        longDescription: profile?.longDescription ?? "",
        industry: profile?.industry ?? "",
        primaryLanguage: profile?.primaryLanguage ?? "English",
        valueProps: profile?.valueProps ?? [],
        proofPoints: profile?.proofPoints ?? [],
        brandVoiceSummary: profile?.brandVoiceSummary ?? "",
        toneAttributes: profile?.toneAttributes ?? [],
        writingRules: profile?.writingRules ?? [],
        bannedPhrases: profile?.bannedPhrases ?? [],
        complianceNotes: profile?.complianceNotes ?? "",
      },
      audiences: audiences.map((audience) => ({
        id: audience.id,
        updatedAt: audience.updatedAt.toISOString(),
      })),
      offers: offers.map((offer) => ({
        id: offer.id,
        updatedAt: offer.updatedAt.toISOString(),
      })),
      documents: eligibleDocuments.map((document) => ({
        id: document.id,
        checksum: document.checksum,
        priority: document.priority,
      })),
    });

    return {
      ...render,
      sourceFingerprint,
      promptVersion: MARKETING_BRAND_CONTEXT_VERSION,
      contextVersion: profile?.contextVersion ?? 1,
      candidateDocuments: eligibleDocuments.map((document) => ({
        id: document.id,
        title: document.title,
        tokenEstimate: document.tokenEstimate,
      })),
      hasProfile: profile !== null,
    };
  },
);

/**
 * Compiles and persists, returning the snapshot every generation cites.
 *
 * Separate from `compileBrandContext` because compiling is free and reading is
 * common, while writing should happen only when something is actually about to
 * be grounded on the result. An unchanged fingerprint reuses the existing row
 * rather than inserting a duplicate.
 */
export async function ensureBrandContextSnapshot(input: {
  workspaceId: string;
}): Promise<{ snapshotId: string; context: CompiledBrandContext }> {
  const context = await compileBrandContext(input);
  const snapshot = await saveBrandContextSnapshot({
    workspaceId: input.workspaceId,
    sourceFingerprint: context.sourceFingerprint,
    promptVersion: context.promptVersion,
    contextVersion: context.contextVersion,
    compiledText: context.text,
    tokenEstimate: context.tokenEstimate,
    includedDocumentIds: context.includedDocumentIds,
    omittedDocumentCount: context.omittedDocumentCount,
    truncated: context.truncated,
  });
  return { snapshotId: snapshot.id, context };
}
