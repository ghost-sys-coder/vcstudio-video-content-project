import { describe, expect, it } from "vitest";

import {
  ONBOARDING_QUESTIONS,
  ONBOARDING_QUESTION_VERSION,
  ONBOARDING_SECTIONS,
  ONBOARDING_SECTION_BLURBS,
  ONBOARDING_SECTION_LABELS,
  getOnboardingQuestion,
  selectQuestionsForSection,
} from "@/lib/marketing/brand/onboarding-questions";

describe("onboarding catalogue", () => {
  it("pins its version", () => {
    // Answers are stored per key against this catalogue; a silent change to the
    // question set is a silent change to what the profile means.
    expect(ONBOARDING_QUESTION_VERSION).toBe("brand-onboarding-v1");
  });

  it("has unique keys", () => {
    const keys = ONBOARDING_QUESTIONS.map((question) => question.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every section at least one question, a label, and a blurb", () => {
    for (const section of ONBOARDING_SECTIONS) {
      expect(selectQuestionsForSection(section).length).toBeGreaterThan(0);
      expect(ONBOARDING_SECTION_LABELS[section]).toBeTruthy();
      expect(ONBOARDING_SECTION_BLURBS[section]).toBeTruthy();
    }
  });

  it("places every question in a known section", () => {
    for (const question of ONBOARDING_QUESTIONS)
      expect(ONBOARDING_SECTIONS).toContain(question.section);
  });

  it("bounds every answer", () => {
    for (const question of ONBOARDING_QUESTIONS) {
      expect(question.maxLength).toBeGreaterThan(0);
      expect(question.maxLength).toBeLessThanOrEqual(2000);
    }
  });

  it("resolves a known key and refuses an unknown one", () => {
    expect(getOnboardingQuestion("business_name")).toBeDefined();
    expect(getOnboardingQuestion("nope")).toBeUndefined();
  });

  it("keeps at least one required question so the interview means something", () => {
    expect(
      ONBOARDING_QUESTIONS.filter((question) => question.required).length,
    ).toBeGreaterThan(0);
  });
});
