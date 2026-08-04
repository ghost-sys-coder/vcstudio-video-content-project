import {
  ONBOARDING_QUESTIONS,
  ONBOARDING_SECTIONS,
  type OnboardingSection,
} from "@/lib/marketing/brand/onboarding-questions";

export type SectionCompleteness = {
  section: OnboardingSection;
  answered: number;
  total: number;
  requiredAnswered: number;
  requiredTotal: number;
  complete: boolean;
};

export type BrandCompleteness = {
  sections: SectionCompleteness[];
  answeredCount: number;
  questionCount: number;
  requiredRemaining: number;
  /** True once every *required* question has a non-empty answer. */
  ready: boolean;
  percent: number;
};

function isAnswered(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * How far through the interview a workspace is.
 *
 * Pure, so the wizard, the Home checklist, and the brand pages all read one
 * calculation rather than three that drift. `ready` tracks **required**
 * questions only: the optional ones improve grounding but must not block a user
 * from finishing, and a progress meter that can never reach its end is worse
 * than none.
 */
export function calculateBrandCompleteness(
  answers: Record<string, string>,
): BrandCompleteness {
  const sections = ONBOARDING_SECTIONS.map((section) => {
    const questions = ONBOARDING_QUESTIONS.filter(
      (question) => question.section === section,
    );
    const required = questions.filter((question) => question.required);
    const answered = questions.filter((question) =>
      isAnswered(answers[question.key]),
    );
    const requiredAnswered = required.filter((question) =>
      isAnswered(answers[question.key]),
    );

    return {
      section,
      answered: answered.length,
      total: questions.length,
      requiredAnswered: requiredAnswered.length,
      requiredTotal: required.length,
      complete: requiredAnswered.length === required.length,
    };
  });

  const answeredCount = ONBOARDING_QUESTIONS.filter((question) =>
    isAnswered(answers[question.key]),
  ).length;
  const requiredTotal = ONBOARDING_QUESTIONS.filter(
    (question) => question.required,
  ).length;
  const requiredAnswered = ONBOARDING_QUESTIONS.filter(
    (question) => question.required && isAnswered(answers[question.key]),
  ).length;

  return {
    sections,
    answeredCount,
    questionCount: ONBOARDING_QUESTIONS.length,
    requiredRemaining: requiredTotal - requiredAnswered,
    ready: requiredAnswered === requiredTotal,
    percent:
      requiredTotal === 0
        ? 100
        : Math.round((requiredAnswered / requiredTotal) * 100),
  };
}
