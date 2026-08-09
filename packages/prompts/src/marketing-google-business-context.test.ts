import { describe, expect, it } from "vitest";
import { renderBrandContextBlock } from "./marketing-brand-context";

describe("Google Business Profile brand context", () => {
  it("labels synchronized facts and marks the primary location", () => {
    const result = renderBrandContextBlock({
      businessName: "VeilCode Studio",
      websiteUrl: null,
      oneLiner: "",
      longDescription: "",
      industry: "",
      primaryLanguage: "English",
      valueProps: [],
      proofPoints: [],
      audiences: [],
      offers: [],
      brandVoiceSummary: "",
      toneAttributes: [],
      writingRules: [],
      bannedPhrases: [],
      complianceNotes: "",
      documents: [],
      googleBusinessLocations: [
        {
          id: "location-1",
          title: "Kampala Studio",
          isPrimary: true,
          categories: ["Video production service"],
          description: "A production studio in Kampala.",
          websiteUri: "https://example.com",
          phoneNumbers: ["+256 700 000000"],
          address: "Plot 8 Studio Road, Kampala, UG",
          regularHours: ["MONDAY 09:00-MONDAY 17:30"],
          serviceArea: "Kampala",
        },
      ],
      maxTokens: 2_500,
    });

    expect(result.text).toContain("## Google Business Profile facts");
    expect(result.text).toContain("### Kampala Studio (primary location)");
    expect(result.text).toContain(
      "Source: synchronized Google Business Profile",
    );
  });
});
