"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { OnboardingQuestion } from "@/lib/marketing/brand/onboarding-questions";

export function OnboardingQuestionField({
  defaultValue,
  disabled,
  onChange,
  question,
}: {
  defaultValue: string;
  disabled: boolean;
  onChange: (key: string, value: string) => void;
  question: OnboardingQuestion;
}) {
  const id = `onboarding-${question.key}`;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {question.prompt}
        {question.required ? null : (
          <span className="ml-1 font-normal text-muted-foreground">
            (optional)
          </span>
        )}
      </Label>
      {question.kind === "longtext" ? (
        <Textarea
          defaultValue={defaultValue}
          disabled={disabled}
          id={id}
          maxLength={question.maxLength}
          name={question.key}
          onChange={(event) => onChange(question.key, event.target.value)}
          placeholder={question.placeholder}
          rows={4}
        />
      ) : (
        <Input
          defaultValue={defaultValue}
          disabled={disabled}
          id={id}
          maxLength={question.maxLength}
          name={question.key}
          onChange={(event) => onChange(question.key, event.target.value)}
          placeholder={question.placeholder}
        />
      )}
      <p className="text-xs text-muted-foreground">{question.helpText}</p>
    </div>
  );
}
