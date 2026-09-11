import "server-only";

import {
  findEditorialSignoff,
  listClaimCitations,
  listProjectSources,
  listScriptClaims,
} from "@/db/repositories/editorial-evidence.repository";
import { normalizeNarrationText } from "@/lib/domain/narration-normalization";
import { anchorClaims } from "@/lib/editorial/claim-anchoring";
import {
  describeEditorialReadiness,
  resolveEditorialSignoff,
  summarizeEditorialReview,
  type ClaimReviewState,
  type ClaimSourceStance,
  type EditorialReviewSummary,
  type ResolvedEditorialSignoff,
} from "@/lib/editorial/editorial-review";

export interface EditorialSourceView {
  id: string;
  kind: "link" | "note";
  title: string;
  url: string | null;
  host: string | null;
  notes: string;
  archived: boolean;
}

export interface EditorialCitationView {
  sourceId: string;
  stance: ClaimSourceStance;
  title: string;
  url: string | null;
  host: string | null;
  excerpt: string;
  /** True when the cited source has since been archived. */
  archived: boolean;
}

export interface EditorialClaimView {
  id: string;
  quotedText: string;
  reviewState: ClaimReviewState;
  reviewNote: string;
  /** False when the quoted sentence is no longer in the draft. */
  anchored: boolean;
  citations: EditorialCitationView[];
}

export interface EditorialReviewView {
  claims: EditorialClaimView[];
  sources: EditorialSourceView[];
  summary: EditorialReviewSummary;
  signoff: ResolvedEditorialSignoff;
  signedBy: { userId: string; at: Date } | null;
  readiness: string;
  /** Fingerprint of the draft this view describes; sent back on sign-off. */
  scriptFingerprint: string;
}

/**
 * Everything the script page needs to show the state of the editorial review.
 *
 * Anchoring is recomputed here on every read rather than stored. The draft
 * changes on a one-second autosave, so any stored "still present" flag would be
 * wrong within a keystroke of being written, and wrong in the dangerous
 * direction: a stale flag says a sentence was reviewed when it has since been
 * rewritten.
 */
export async function loadEditorialReviewView(input: {
  workspaceId: string;
  projectId: string;
  draftContent: string;
}): Promise<EditorialReviewView> {
  const scope = { workspaceId: input.workspaceId, projectId: input.projectId };
  const [claims, sources, signoff] = await Promise.all([
    listScriptClaims(scope),
    listProjectSources(scope, { includeArchived: true }),
    findEditorialSignoff(scope),
  ]);
  const citations = await listClaimCitations({
    workspaceId: input.workspaceId,
    claimIds: claims.map((claim) => claim.id),
  });

  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const citationsByClaim = new Map<string, EditorialCitationView[]>();
  for (const citation of citations) {
    const source = sourcesById.get(citation.sourceId);
    if (!source) continue;
    const list = citationsByClaim.get(citation.claimId) ?? [];
    list.push({
      sourceId: source.id,
      stance: citation.stance,
      title: source.title,
      url: source.url,
      host: source.host,
      excerpt: citation.excerpt,
      archived: source.archivedAt !== null,
    });
    citationsByClaim.set(citation.claimId, list);
  }

  const anchored = anchorClaims({
    scriptContent: input.draftContent,
    claims,
  });
  const claimViews: EditorialClaimView[] = anchored.map((entry) => ({
    id: entry.claim.id,
    quotedText: entry.claim.quotedText,
    reviewState: entry.claim.reviewState,
    reviewNote: entry.claim.reviewNote,
    anchored: entry.anchored,
    citations: citationsByClaim.get(entry.claim.id) ?? [],
  }));
  const staleClaimIds = anchored
    .filter((entry) => !entry.anchored)
    .map((entry) => entry.claim.id);

  const summary = summarizeEditorialReview({
    claims: claimViews,
    staleClaimIds,
  });
  const scriptFingerprint = normalizeNarrationText(input.draftContent);
  return {
    claims: claimViews,
    sources: sources
      .filter((source) => source.archivedAt === null)
      .map((source) => ({
        id: source.id,
        kind: source.kind,
        title: source.title,
        url: source.url,
        host: source.host,
        notes: source.notes,
        archived: false,
      })),
    summary,
    signoff: resolveEditorialSignoff({
      signoff: signoff
        ? {
            signedAt: signoff.signedAt,
            coveredClaims: signoff.coveredClaims,
            scriptFingerprint: signoff.scriptFingerprint,
          }
        : null,
      claims: claimViews,
      staleClaimIds,
      scriptFingerprint,
    }),
    signedBy: signoff
      ? { userId: signoff.signedByUserId, at: signoff.signedAt }
      : null,
    readiness: describeEditorialReadiness(summary),
    scriptFingerprint,
  };
}
