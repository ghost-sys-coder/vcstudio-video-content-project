import {
  isSubstantiveMarketingEdit,
  normalizeMarketingText,
} from "@/lib/marketing/metrics/substantive-edit";

export const MINIMUM_CONFIDENT_SAMPLE_SIZE = 20;

export type QualityItemFact = {
  id: string;
  createdAt: Date;
  sourceRunId: string | null;
  costCents: number;
  model: string;
  promptVersion: string;
  skillKey: string;
  skillVersion: number;
  contextVersion: number | null;
  currentText: string;
};
export type QualityReviewFact = {
  contentItemId: string;
  decision: "approved" | "changes_requested" | "archived";
  reason: string;
  createdAt: Date;
};
export type QualityRevisionFact = {
  contentItemId: string;
  revisionNumber: number;
  changeSource: "ai" | "human";
  bodyPlainText: string;
  structuredPayload: Record<string, unknown> | null;
};
export type QualityPublicationFact = {
  contentItemId: string;
  platform: string;
  status: "published" | "failed";
};
export type MetricBreakdown = { label: string; count: number };
export type MarketingQualityMetrics = {
  generated: number;
  reviewed: number;
  approved: number;
  rejected: number;
  approvalRate: number | null;
  substantiveEditRate: number | null;
  duplicateContentRate: number | null;
  averageFirstReviewHours: number | null;
  averageApprovalHours: number | null;
  publicationSuccessRate: number | null;
  costPerApprovedCents: number | null;
  costPerPublishedCents: number | null;
  sampleConfidence: "empty" | "low" | "sufficient";
  rejectionReasons: MetricBreakdown[];
  publicationByPlatform: {
    platform: string;
    published: number;
    failed: number;
  }[];
  versions: {
    model: MetricBreakdown[];
    prompt: MetricBreakdown[];
    skill: MetricBreakdown[];
    brandContext: MetricBreakdown[];
  };
};

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}
function average(values: number[]): number | null {
  return values.length === 0
    ? null
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}
function breakdown(values: string[]): MetricBreakdown[] {
  const counts = new Map<string, number>();
  for (const value of values)
    counts.set(value || "Unknown", (counts.get(value || "Unknown") ?? 0) + 1);
  return [...counts]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function calculateMarketingQualityMetrics(input: {
  items: QualityItemFact[];
  reviews: QualityReviewFact[];
  revisions: QualityRevisionFact[];
  publications: QualityPublicationFact[];
}): MarketingQualityMetrics {
  const generatedItems = input.items.filter(
    (item) => item.sourceRunId !== null,
  );
  const reviewsByItem = new Map<string, QualityReviewFact[]>();
  for (const review of input.reviews)
    reviewsByItem.set(review.contentItemId, [
      ...(reviewsByItem.get(review.contentItemId) ?? []),
      review,
    ]);
  const reviewedItems = generatedItems.filter(
    (item) => (reviewsByItem.get(item.id)?.length ?? 0) > 0,
  );
  const approvedItems = generatedItems.filter((item) =>
    reviewsByItem
      .get(item.id)
      ?.some((review) => review.decision === "approved"),
  );
  const rejectedItems = generatedItems.filter((item) =>
    reviewsByItem
      .get(item.id)
      ?.some(
        (review) =>
          review.decision === "changes_requested" ||
          review.decision === "archived",
      ),
  );
  const revisionsByItem = new Map<string, QualityRevisionFact[]>();
  for (const revision of input.revisions)
    revisionsByItem.set(revision.contentItemId, [
      ...(revisionsByItem.get(revision.contentItemId) ?? []),
      revision,
    ]);
  let humanEdited = 0;
  let substantiveEdits = 0;
  for (const item of generatedItems) {
    const revisions = (revisionsByItem.get(item.id) ?? []).sort(
      (a, b) => a.revisionNumber - b.revisionNumber,
    );
    const original = revisions.find(
      (revision) => revision.changeSource === "ai",
    );
    const latestHuman = revisions.findLast(
      (revision) => revision.changeSource === "human",
    );
    if (!original || !latestHuman) continue;
    humanEdited += 1;
    if (
      isSubstantiveMarketingEdit({
        originalText: original.bodyPlainText,
        revisedText: latestHuman.bodyPlainText,
        originalStructuredPayload: original.structuredPayload,
        revisedStructuredPayload: latestHuman.structuredPayload,
      })
    )
      substantiveEdits += 1;
  }
  const textCounts = new Map<string, number>();
  for (const item of generatedItems) {
    const normalized = normalizeMarketingText(item.currentText);
    if (normalized)
      textCounts.set(normalized, (textCounts.get(normalized) ?? 0) + 1);
  }
  const duplicateItems = [...textCounts.values()].reduce(
    (sum, count) => sum + (count > 1 ? count : 0),
    0,
  );
  const firstReviewHours: number[] = [];
  const approvalHours: number[] = [];
  for (const item of generatedItems) {
    const reviews = (reviewsByItem.get(item.id) ?? []).sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    if (reviews[0])
      firstReviewHours.push(
        (reviews[0].createdAt.getTime() - item.createdAt.getTime()) / 3_600_000,
      );
    const approval = reviews.find((review) => review.decision === "approved");
    if (approval)
      approvalHours.push(
        (approval.createdAt.getTime() - item.createdAt.getTime()) / 3_600_000,
      );
  }
  const generatedIds = new Set(generatedItems.map((item) => item.id));
  const publications = input.publications.filter((publication) =>
    generatedIds.has(publication.contentItemId),
  );
  const publishedItemIds = new Set(
    publications
      .filter((publication) => publication.status === "published")
      .map((publication) => publication.contentItemId),
  );
  const totalCost = generatedItems.reduce(
    (sum, item) => sum + item.costCents,
    0,
  );
  const platforms = new Map<string, { published: number; failed: number }>();
  for (const publication of publications) {
    const value = platforms.get(publication.platform) ?? {
      published: 0,
      failed: 0,
    };
    value[publication.status] += 1;
    platforms.set(publication.platform, value);
  }
  return {
    generated: generatedItems.length,
    reviewed: reviewedItems.length,
    approved: approvedItems.length,
    rejected: rejectedItems.length,
    approvalRate: rate(approvedItems.length, reviewedItems.length),
    substantiveEditRate: rate(substantiveEdits, humanEdited),
    duplicateContentRate: rate(duplicateItems, generatedItems.length),
    averageFirstReviewHours: average(firstReviewHours),
    averageApprovalHours: average(approvalHours),
    publicationSuccessRate: rate(
      publications.filter((publication) => publication.status === "published")
        .length,
      publications.length,
    ),
    costPerApprovedCents: approvedItems.length
      ? totalCost / approvedItems.length
      : null,
    costPerPublishedCents: publishedItemIds.size
      ? totalCost / publishedItemIds.size
      : null,
    sampleConfidence:
      generatedItems.length === 0
        ? "empty"
        : generatedItems.length < MINIMUM_CONFIDENT_SAMPLE_SIZE
          ? "low"
          : "sufficient",
    rejectionReasons: breakdown(
      input.reviews
        .filter(
          (review) => review.decision !== "approved" && review.reason.trim(),
        )
        .map((review) => review.reason.trim()),
    ),
    publicationByPlatform: [...platforms]
      .map(([platform, value]) => ({ platform, ...value }))
      .sort((a, b) => a.platform.localeCompare(b.platform)),
    versions: {
      model: breakdown(generatedItems.map((item) => item.model)),
      prompt: breakdown(generatedItems.map((item) => item.promptVersion)),
      skill: breakdown(
        generatedItems.map(
          (item) => `${item.skillKey || "Unknown"} v${item.skillVersion}`,
        ),
      ),
      brandContext: breakdown(
        generatedItems.map((item) =>
          item.contextVersion === null
            ? "Unknown"
            : `Context v${item.contextVersion}`,
        ),
      ),
    },
  };
}
