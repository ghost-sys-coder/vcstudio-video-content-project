import { describe, expect, it } from "vitest";

import {
  MAX_LIST_ITEMS,
  brandAudienceSchema,
  brandOfferSchema,
  brandProfileSchema,
  readBrandAudienceForm,
  readBrandOfferForm,
  saveOnboardingAnswersSchema,
  stringListSchema,
} from "@/lib/schemas/marketing-brand";

describe("stringListSchema", () => {
  it("drops blank lines and trims each entry", () => {
    const parsed = stringListSchema.safeParse("  one  \n\n two \n\n\n");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual(["one", "two"]);
  });

  it("rejects more entries than the ceiling", () => {
    const tooMany = Array.from({ length: MAX_LIST_ITEMS + 1 }, (_, i) =>
      String(i),
    ).join("\n");
    expect(stringListSchema.safeParse(tooMany).success).toBe(false);
  });

  it("treats an empty textarea as an empty list, not a blank entry", () => {
    const parsed = stringListSchema.safeParse("");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual([]);
  });
});

describe("saveOnboardingAnswersSchema", () => {
  it("rejects an answer to a question that is not in the catalogue", () => {
    // Silently dropping it would look like data loss to the user.
    const parsed = saveOnboardingAnswersSchema.safeParse({
      answers: [{ questionKey: "not_a_question", answerText: "hi" }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects an answer past that question's own limit", () => {
    const parsed = saveOnboardingAnswersSchema.safeParse({
      answers: [{ questionKey: "business_name", answerText: "x".repeat(121) }],
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a duplicated question key", () => {
    const parsed = saveOnboardingAnswersSchema.safeParse({
      answers: [
        { questionKey: "business_name", answerText: "a" },
        { questionKey: "business_name", answerText: "b" },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts an empty answer so a section can be saved part-finished", () => {
    const parsed = saveOnboardingAnswersSchema.safeParse({
      answers: [{ questionKey: "business_name", answerText: "" }],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("brandProfileSchema", () => {
  const valid = {
    businessName: "VeilCode",
    websiteUrl: "https://veilcode.studio",
    oneLiner: "We make things",
    longDescription: "",
    industry: "Software",
    primaryLanguage: "English",
    timezone: "UTC",
  };

  it("accepts a blank website", () => {
    expect(
      brandProfileSchema.safeParse({ ...valid, websiteUrl: "" }).success,
    ).toBe(true);
  });

  it("rejects a website without a scheme", () => {
    expect(
      brandProfileSchema.safeParse({ ...valid, websiteUrl: "veilcode.studio" })
        .success,
    ).toBe(false);
  });
});

describe("brand form readers", () => {
  it("reads an unticked primary checkbox as false", () => {
    const data = new FormData();
    data.set("name", "Solo creators");
    const parsed = brandAudienceSchema.safeParse(readBrandAudienceForm(data));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.isPrimary).toBe(false);
  });

  it("reads an empty audience select as null rather than an empty string", () => {
    const data = new FormData();
    data.set("name", "Subscription");
    data.set("audienceId", "");
    const parsed = brandOfferSchema.safeParse(readBrandOfferForm(data));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.audienceId).toBeNull();
  });

  it("requires a name", () => {
    const data = new FormData();
    data.set("name", "   ");
    expect(
      brandAudienceSchema.safeParse(readBrandAudienceForm(data)).success,
    ).toBe(false);
  });
});
