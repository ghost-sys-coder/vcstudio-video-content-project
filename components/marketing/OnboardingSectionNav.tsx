"use client";

import { CheckIcon } from "lucide-react";
import type { SectionCompleteness } from "@/lib/marketing/brand/brand-completeness";
import {
  ONBOARDING_SECTION_LABELS,
  type OnboardingSection,
} from "@/lib/marketing/brand/onboarding-questions";

/**
 * Section switcher for the interview.
 *
 * Every section is reachable at any time rather than gated behind the previous
 * one. A business owner knows their pricing before they can articulate their
 * voice, and forcing a linear order makes people type filler to move on — which
 * is exactly the input that produces bad grounding.
 */
export function OnboardingSectionNav({
  activeSection,
  onSelect,
  sections,
}: {
  activeSection: OnboardingSection;
  onSelect: (section: OnboardingSection) => void;
  sections: SectionCompleteness[];
}) {
  return (
    <nav aria-label="Interview sections">
      <ol className="flex flex-wrap gap-2">
        {sections.map((section) => {
          const isActive = section.section === activeSection;
          return (
            <li key={section.section}>
              <button
                aria-current={isActive ? "step" : undefined}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${
                  isActive
                    ? "border-primary/50 bg-accent font-medium"
                    : "hover:bg-accent"
                }`}
                onClick={() => onSelect(section.section)}
                type="button"
              >
                {section.complete ? (
                  <CheckIcon
                    aria-hidden
                    className="size-3.5 text-notice-ready-foreground"
                  />
                ) : null}
                <span>{ONBOARDING_SECTION_LABELS[section.section]}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {section.answered}/{section.total}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
