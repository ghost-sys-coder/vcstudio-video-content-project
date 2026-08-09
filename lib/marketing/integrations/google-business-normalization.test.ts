import { describe, expect, it } from "vitest";
import { normalizeGoogleBusinessLocation } from "@/lib/marketing/integrations/google-business-normalization";

describe("normalizeGoogleBusinessLocation", () => {
  it("maps provider location details into bounded grounding fields", () => {
    expect(
      normalizeGoogleBusinessLocation({
        title: "Kampala Studio",
        storeCode: "KLA-01",
        websiteUri: "https://example.com",
        phoneNumbers: {
          primaryPhone: "+256 700 000000",
          additionalPhones: ["+256 701 000000"],
        },
        categories: {
          primaryCategory: { displayName: "Video production service" },
          additionalCategories: [{ displayName: "Marketing agency" }],
        },
        profile: { description: "A production studio in Kampala." },
        storefrontAddress: {
          addressLines: ["Plot 8 Studio Road"],
          locality: "Kampala",
          regionCode: "UG",
        },
        regularHours: {
          periods: [
            {
              openDay: "MONDAY",
              openTime: { hours: 9 },
              closeDay: "MONDAY",
              closeTime: { hours: 17, minutes: 30 },
            },
          ],
        },
        serviceArea: {
          places: { placeInfos: [{ placeName: "Kampala" }] },
        },
      }),
    ).toEqual({
      title: "Kampala Studio",
      storeCode: "KLA-01",
      categories: ["Video production service", "Marketing agency"],
      primaryCategory: "Video production service",
      description: "A production studio in Kampala.",
      websiteUri: "https://example.com",
      phoneNumbers: ["+256 700 000000", "+256 701 000000"],
      addressLines: ["Plot 8 Studio Road"],
      locality: "Kampala",
      administrativeArea: "",
      postalCode: "",
      regionCode: "UG",
      regularHours: ["MONDAY 09:00-MONDAY 17:30"],
      serviceArea: "Kampala",
    });
  });
});
