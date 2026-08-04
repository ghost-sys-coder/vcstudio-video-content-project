"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import {
  completeOnboardingAction,
  saveOnboardingAnswersAction,
} from "@/app/(authenticated)/app/marketing/brand/actions";
import { OnboardingQuestionField } from "@/components/marketing/OnboardingQuestionField";
import { OnboardingSectionNav } from "@/components/marketing/OnboardingSectionNav";
import { Button } from "@/components/ui/button";
import { calculateBrandCompleteness } from "@/lib/marketing/brand/brand-completeness";
import {
  ONBOARDING_SECTION_BLURBS,
  ONBOARDING_SECTION_LABELS,
  ONBOARDING_SECTIONS,
  selectQuestionsForSection,
  type OnboardingSection,
} from "@/lib/marketing/brand/onboarding-questions";

/**
 * The business interview.
 *
 * One form containing **every** question, with only the active section visible.
 * Sections could have been separate forms, but then switching section would
 * either lose unsaved edits or need a save on every switch — and answers to
 * different sections inform each other, so people move back and forth. Hidden
 * inputs keep the whole set posted whichever section is on screen.
 *
 * Progress is recalculated live from local state using the same pure function
 * the server uses to decide whether the interview may be completed, so the
 * meter and the server can never disagree.
 */
export function BrandOnboardingWizard({
  initialAnswers,
  isComplete,
}: {
  initialAnswers: Record<string, string>;
  isComplete: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState(initialAnswers);
  const [activeSection, setActiveSection] =
    useState<OnboardingSection>("identity");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const completeness = useMemo(
    () => calculateBrandCompleteness(answers),
    [answers],
  );

  function updateAnswer(key: string, value: string) {
    setAnswers((current) => ({ ...current, [key]: value }));
  }

  function submit(formData: FormData, finish: boolean) {
    setError(null);
    setSavedAt(null);
    startTransition(async () => {
      const result = finish
        ? await completeOnboardingAction(formData)
        : await saveOnboardingAnswersAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (finish) {
        router.push("/app/marketing/brand");
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  const activeQuestions = selectQuestionsForSection(activeSection);
  const sectionIndex = ONBOARDING_SECTIONS.indexOf(activeSection);
  const nextSection = ONBOARDING_SECTIONS[sectionIndex + 1];

  return (
    <form className="space-y-6">
      <div className="space-y-3">
        <OnboardingSectionNav
          activeSection={activeSection}
          onSelect={setActiveSection}
          sections={completeness.sections}
        />
        <div
          aria-label="Interview progress"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={completeness.percent}
          className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${completeness.percent}%` }}
          />
        </div>
        <p aria-live="polite" className="text-xs text-muted-foreground">
          {completeness.ready
            ? "Every required question is answered."
            : `${completeness.requiredRemaining} required question${
                completeness.requiredRemaining === 1 ? "" : "s"
              } left.`}
        </p>
      </div>

      <section className="space-y-4 rounded-xl border p-4">
        <div>
          <h2 className="text-sm font-medium">
            {ONBOARDING_SECTION_LABELS[activeSection]}
          </h2>
          <p className="text-xs text-muted-foreground">
            {ONBOARDING_SECTION_BLURBS[activeSection]}
          </p>
        </div>
        {activeQuestions.map((question) => (
          <OnboardingQuestionField
            defaultValue={answers[question.key] ?? ""}
            disabled={pending}
            key={question.key}
            onChange={updateAnswer}
            question={question}
          />
        ))}
      </section>

      {/*
        Questions outside the active section stay in the form as hidden inputs,
        so a partial save never wipes an answer the user cannot currently see.
      */}
      {ONBOARDING_SECTIONS.filter((section) => section !== activeSection).map(
        (section) =>
          selectQuestionsForSection(section).map((question) => (
            <input
              key={question.key}
              name={question.key}
              type="hidden"
              value={answers[question.key] ?? ""}
            />
          )),
      )}

      {error ? (
        <p
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={pending}
          formAction={(formData) => submit(formData, false)}
          type="submit"
          variant="outline"
        >
          {pending ? (
            <>
              <Loader2Icon aria-hidden className="animate-spin" />
              Saving…
            </>
          ) : (
            "Save progress"
          )}
        </Button>

        {nextSection ? (
          <Button
            disabled={pending}
            onClick={() => setActiveSection(nextSection)}
            type="button"
            variant="ghost"
          >
            Next: {ONBOARDING_SECTION_LABELS[nextSection]}
          </Button>
        ) : null}

        <Button
          className="ml-auto"
          disabled={pending || !completeness.ready}
          formAction={(formData) => submit(formData, true)}
          type="submit"
        >
          <CheckCircle2Icon />
          {isComplete ? "Save and finish" : "Finish interview"}
        </Button>
      </div>

      <p aria-live="polite" className="text-xs text-muted-foreground">
        {savedAt ? `Saved at ${savedAt}` : null}
      </p>
    </form>
  );
}
