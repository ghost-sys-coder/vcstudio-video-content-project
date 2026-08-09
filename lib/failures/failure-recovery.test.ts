import { describe, expect, it } from "vitest";
import {
  classifyFailure,
  createFailurePresentation,
  failureTaxonomies,
} from "@/lib/failures/failure-recovery";

const examples = [
  ["validation", "validation_failed"],
  ["authorization", "token_expired"],
  ["configuration", "provider_not_configured"],
  ["quota", "rate_limit"],
  ["budget", "monthly_rule_budget"],
  ["unsupported_media", "unsupported_media_format"],
  ["transient_provider", "provider_temporarily_unavailable"],
  ["ambiguous_provider_outcome", "transport_ambiguous"],
  ["internal", "unexpected_failure"],
] as const;

describe("failure recovery", () => {
  it("classifies and presents every taxonomy", () => {
    expect(
      examples.map(([expected, category]) => [
        expected,
        classifyFailure(category),
      ]),
    ).toEqual(examples.map(([expected]) => [expected, expected]));
    expect(new Set(examples.map(([expected]) => expected))).toEqual(
      new Set(failureTaxonomies),
    );
    for (const [taxonomy, category] of examples) {
      const presentation = createFailurePresentation({
        errorCategory: category,
        source: "social_destination",
        sourceHref: "/source",
        correlationId: "social-target:00000000-0000-4000-8000-000000000000",
      });
      expect(presentation.taxonomy).toBe(taxonomy);
      expect(presentation.actions.length).toBeGreaterThan(0);
    }
  });

  it("never offers retry for permanent or ambiguous failures", () => {
    for (const category of [
      "validation_failed",
      "token_expired",
      "provider_not_configured",
      "rate_limit",
      "monthly_rule_budget",
      "unsupported_media",
      "transport_ambiguous",
    ]) {
      const presentation = createFailurePresentation({
        errorCategory: category,
        source: "social_destination",
        sourceHref: "/source",
        correlationId: "safe-id",
      });
      expect(
        presentation.actions.some((action) =>
          action.label.toLowerCase().includes("retry"),
        ),
      ).toBe(false);
    }
    expect(
      createFailurePresentation({
        errorCategory: "transport_ambiguous",
        source: "social_destination",
        sourceHref: "/source",
        correlationId: "safe-id",
      }).retrySafety,
    ).toBe("prohibited");
  });

  it("only permits controlled retry for a transient provider failure", () => {
    const presentation = createFailurePresentation({
      errorCategory: "provider_unavailable",
      source: "render",
      sourceHref: "/render",
      correlationId: "safe-id",
    });
    expect(presentation.retrySafety).toBe("safe_from_durable_input");
    expect(presentation.actions).toContainEqual({
      kind: "link",
      label: "Open safe retry controls",
      href: "/render",
    });
  });
});
