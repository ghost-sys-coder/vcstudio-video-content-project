import { describe, expect, it } from "vitest";

import {
  MARKETING_DOCUMENT_KEY_FACT_COUNT,
  MARKETING_DOCUMENT_KEY_FACT_MAX_CHARACTERS,
  MARKETING_DOCUMENT_SUMMARY_MAX_CHARACTERS,
  marketingDocumentSummaryOutputSchema,
} from "@/lib/schemas/marketing-document-summary";

const valid = {
  summary: "A short summary of the document.",
  keyFacts: ["Pricing starts at $20 per month."],
  documentType: "pricing" as const,
};

describe("marketingDocumentSummaryOutputSchema", () => {
  it("accepts a well-formed summary", () => {
    expect(marketingDocumentSummaryOutputSchema.parse(valid)).toEqual(valid);
  });

  it("accepts an empty fact list for an uninformative document", () => {
    // The prompt instructs the model to return no facts rather than invent
    // some, so the schema has to allow it or that instruction is unfollowable.
    expect(
      marketingDocumentSummaryOutputSchema.safeParse({
        ...valid,
        keyFacts: [],
      }).success,
    ).toBe(true);
  });

  it("rejects an empty summary", () => {
    expect(
      marketingDocumentSummaryOutputSchema.safeParse({ ...valid, summary: "" })
        .success,
    ).toBe(false);
  });

  it("rejects a summary long enough to crowd out the rest of the corpus", () => {
    expect(
      marketingDocumentSummaryOutputSchema.safeParse({
        ...valid,
        summary: "x".repeat(MARKETING_DOCUMENT_SUMMARY_MAX_CHARACTERS + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects more facts than the contract allows", () => {
    expect(
      marketingDocumentSummaryOutputSchema.safeParse({
        ...valid,
        keyFacts: Array.from(
          { length: MARKETING_DOCUMENT_KEY_FACT_COUNT + 1 },
          (_, index) => `fact ${index}`,
        ),
      }).success,
    ).toBe(false);
  });

  it("rejects an over-long single fact", () => {
    expect(
      marketingDocumentSummaryOutputSchema.safeParse({
        ...valid,
        keyFacts: ["x".repeat(MARKETING_DOCUMENT_KEY_FACT_MAX_CHARACTERS + 1)],
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown document type", () => {
    expect(
      marketingDocumentSummaryOutputSchema.safeParse({
        ...valid,
        documentType: "invoice",
      }).success,
    ).toBe(false);
  });

  it("trims whitespace so a blank-padded summary is still rejected", () => {
    expect(
      marketingDocumentSummaryOutputSchema.safeParse({
        ...valid,
        summary: "   ",
      }).success,
    ).toBe(false);
  });
});
