export const failureTaxonomies = [
  "validation",
  "authorization",
  "configuration",
  "quota",
  "budget",
  "unsupported_media",
  "transient_provider",
  "ambiguous_provider_outcome",
  "internal",
] as const;

export type FailureTaxonomy = (typeof failureTaxonomies)[number];
export type FailureSource =
  | "scene_image"
  | "scene_audio"
  | "render"
  | "social_destination"
  | "marketing_content"
  | "marketing_schedule"
  | "google_business";

export type RecoveryAction =
  | { kind: "link"; label: string; href: string }
  | { kind: "copy"; label: string; value: string }
  | { kind: "instruction"; label: string };

export type FailurePresentation = {
  taxonomy: FailureTaxonomy;
  heading: string;
  guidance: string;
  actions: RecoveryAction[];
  retrySafety: "not_applicable" | "safe_from_durable_input" | "prohibited";
};

const RETRY_LABEL = "Open safe retry controls";

export function classifyFailure(errorCategory: string | null): FailureTaxonomy {
  const category = errorCategory?.toLowerCase() ?? "";
  if (/ambiguous|unknown_outcome|dispatch_unknown/.test(category))
    return "ambiguous_provider_outcome";
  if (
    /unauthor|forbidden|permission|credential|token|connection_expired/.test(
      category,
    )
  )
    return "authorization";
  if (
    /not_configured|configuration|missing_config|provider_disabled/.test(
      category,
    )
  )
    return "configuration";
  if (/rate_limit|quota/.test(category)) return "quota";
  if (/budget|spend|cost_cap|monthly_rule_budget/.test(category))
    return "budget";
  if (/unsupported|media|mime|codec|aspect|file_size|format/.test(category))
    return "unsupported_media";
  if (/validation|invalid|malformed|schema/.test(category)) return "validation";
  if (
    /transient|temporar|unavailable|network|timeout|connection_reset|overloaded/.test(
      category,
    )
  )
    return "transient_provider";
  return "internal";
}

function reconnectHref(source: FailureSource, fallbackHref: string): string {
  if (source === "google_business") return "/app/marketing/integrations";
  if (source === "social_destination") return "/app/social/accounts";
  return fallbackHref;
}

export function createFailurePresentation(input: {
  errorCategory: string | null;
  source: FailureSource;
  sourceHref: string;
  correlationId: string;
}): FailurePresentation {
  const taxonomy = classifyFailure(input.errorCategory);
  switch (taxonomy) {
    case "validation":
      return {
        taxonomy,
        heading: "Input needs correction",
        guidance:
          "Correct the saved input, then start a new attempt from the source screen.",
        retrySafety: "not_applicable",
        actions: [
          { kind: "link", label: "Correct input", href: input.sourceHref },
        ],
      };
    case "authorization":
      return {
        taxonomy,
        heading: "Connection authorization required",
        guidance:
          "Reconnect the affected account before attempting this operation again.",
        retrySafety: "not_applicable",
        actions: [
          {
            kind: "link",
            label: "Reconnect",
            href: reconnectHref(input.source, input.sourceHref),
          },
        ],
      };
    case "configuration":
      return {
        taxonomy,
        heading: "Configuration required",
        guidance:
          "Complete the missing configuration, then return to the exact failed item.",
        retrySafety: "not_applicable",
        actions: [
          {
            kind: "link",
            label: "Review configuration",
            href: input.sourceHref,
          },
        ],
      };
    case "quota":
      return {
        taxonomy,
        heading: "Provider quota reached",
        guidance:
          "Wait for the provider quota window to reset. Starting another attempt now is unlikely to succeed.",
        retrySafety: "not_applicable",
        actions: [{ kind: "instruction", label: "Wait for quota reset" }],
      };
    case "budget":
      return {
        taxonomy,
        heading: "Budget or spending cap reached",
        guidance:
          "Review workspace and project spending limits before starting another billable attempt.",
        retrySafety: "not_applicable",
        actions: [
          { kind: "link", label: "Open budget settings", href: "/app/usage" },
        ],
      };
    case "unsupported_media":
      return {
        taxonomy,
        heading: "Media is unsupported",
        guidance:
          "Replace or re-export the media using the requirements shown on the source screen.",
        retrySafety: "not_applicable",
        actions: [
          { kind: "link", label: "Replace media", href: input.sourceHref },
        ],
      };
    case "transient_provider":
      return {
        taxonomy,
        heading: "Provider temporarily unavailable",
        guidance:
          "The saved input is durable. Use the source screen to start a controlled retry.",
        retrySafety: "safe_from_durable_input",
        actions: [{ kind: "link", label: RETRY_LABEL, href: input.sourceHref }],
      };
    case "ambiguous_provider_outcome":
      return {
        taxonomy,
        heading: "Provider outcome is uncertain",
        guidance:
          "Do not retry automatically: the operation may already have been billed or published. Inspect the exact destination and use the correlation ID for support.",
        retrySafety: "prohibited",
        actions: [
          {
            kind: "link",
            label: "Inspect exact failure",
            href: input.sourceHref,
          },
          {
            kind: "copy",
            label: "Copy correlation ID",
            value: input.correlationId,
          },
        ],
      };
    case "internal":
      return {
        taxonomy,
        heading: "Internal operation failed",
        guidance:
          "Open the last durable stage. If it cannot be resumed safely, provide the correlation ID to support.",
        retrySafety: "not_applicable",
        actions: [
          { kind: "link", label: "Open durable stage", href: input.sourceHref },
          {
            kind: "copy",
            label: "Copy correlation ID",
            value: input.correlationId,
          },
        ],
      };
  }
}
