import { describe, expect, it } from "vitest";

import { calculateBrandCompleteness } from "@/lib/marketing/brand/brand-completeness";
import { ONBOARDING_QUESTIONS } from "@/lib/marketing/brand/onboarding-questions";

function answerAll(
  filter: (question: (typeof ONBOARDING_QUESTIONS)[number]) => boolean,
): Record<string, string> {
  return Object.fromEntries(
    ONBOARDING_QUESTIONS.filter(filter).map((question) => [
      question.key,
      "an answer",
    ]),
  );
}

describe("calculateBrandCompleteness", () => {
  it("is not ready with nothing answered", () => {
    const result = calculateBrandCompleteness({});
    expect(result.ready).toBe(false);
    expect(result.percent).toBe(0);
    expect(result.answeredCount).toBe(0);
  });

  it("becomes ready on the required questions alone", () => {
    // Optional questions improve grounding but must never block finishing — a
    // meter that cannot reach its end is worse than none.
    const result = calculateBrandCompleteness(
      answerAll((question) => question.required),
    );
    expect(result.ready).toBe(true);
    expect(result.percent).toBe(100);
    expect(result.requiredRemaining).toBe(0);
    expect(result.answeredCount).toBeLessThan(result.questionCount);
  });

  it("treats whitespace as unanswered", () => {
    const answers = answerAll((question) => question.required);
    const firstRequired = ONBOARDING_QUESTIONS.find(
      (question) => question.required,
    );
    if (firstRequired) answers[firstRequired.key] = "   \n  ";

    const result = calculateBrandCompleteness(answers);
    expect(result.ready).toBe(false);
    expect(result.requiredRemaining).toBe(1);
  });

  it("ignores an answer to a question that is not in the catalogue", () => {
    const result = calculateBrandCompleteness({ not_a_question: "hello" });
    expect(result.answeredCount).toBe(0);
    expect(result.ready).toBe(false);
  });

  it("reports per-section progress", () => {
    const identity = ONBOARDING_QUESTIONS.filter(
      (question) => question.section === "identity",
    );
    const result = calculateBrandCompleteness(
      answerAll((question) => question.section === "identity"),
    );
    const section = result.sections.find(
      (entry) => entry.section === "identity",
    );
    expect(section?.answered).toBe(identity.length);
    expect(section?.complete).toBe(true);
    expect(result.ready).toBe(false);
  });
});
