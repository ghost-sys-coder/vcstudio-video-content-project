import type { MarketingOperation, MarketingRunStatus } from "@/db/schema";

export const MARKETING_OPERATION_LABELS: Record<MarketingOperation, string> = {
  chat_turn: "Chat",
  content_draft: "Content draft",
  ad_creative_copy: "Ad creative",
  blog_post: "Blog post",
  email_draft: "Email",
  newsletter_draft: "Newsletter",
  campaign_plan: "Campaign plan",
  media_story: "Media story",
  document_summary: "Document summary",
  competitor_analysis: "Competitor analysis",
  trend_scan: "Trend scan",
  image_generation: "Marketing image",
};

export const MARKETING_OPERATION_PROVIDERS: Record<MarketingOperation, string> =
  {
    chat_turn: "openai",
    content_draft: "openai",
    ad_creative_copy: "openai",
    blog_post: "openai",
    email_draft: "openai",
    newsletter_draft: "openai",
    campaign_plan: "openai",
    media_story: "openai",
    document_summary: "openai",
    competitor_analysis: "openai",
    trend_scan: "openai",
    image_generation: "openai",
  };

export const MARKETING_RUN_STATUS_LABELS: Record<MarketingRunStatus, string> = {
  pending: "Reserved",
  queued: "Queued",
  running: "Running",
  succeeded: "Settled",
  failed: "Failed",
  cancelled: "Cancelled",
};

/**
 * Resolves an unknown operation string from the database to a label.
 *
 * The grouped-spend query returns `operation` as plain text, and an enum value
 * added by a migration that has landed ahead of a deploy would otherwise render
 * as a blank cell. Falling back to the raw value keeps the number attributable.
 */
export function marketingOperationLabel(operation: string): string {
  return (
    MARKETING_OPERATION_LABELS[operation as MarketingOperation] ?? operation
  );
}
