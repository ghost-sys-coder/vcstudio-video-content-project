"use client";

import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  InfoIcon,
  type LucideIcon,
} from "lucide-react";
import {
  presentEligibility,
  toneClassName,
} from "@/lib/social/eligibility-tone";
import { getPlatformPostCapability } from "@/lib/social/platform-post-capabilities";
import type { PlatformEligibility } from "@/lib/social/select-eligible-platforms";
import { CONTENT_PLATFORM_LABELS } from "@/lib/platforms/platform-labels";

const TONE_ICONS = {
  ready: CheckCircle2Icon,
  info: InfoIcon,
  warning: AlertTriangleIcon,
} as const satisfies Record<string, LucideIcon>;

/**
 * What one platform will actually receive.
 *
 * Shows the **exact** output of `renderPortableDocumentToPlainText` — the same
 * string the publish path sends — so the formatting the editor allows but the
 * platform drops is visible while writing rather than discovered afterwards.
 */
export function PlatformPreviewCard({
  eligibility,
  plainText,
}: {
  eligibility: PlatformEligibility;
  plainText: string;
}) {
  const capability = getPlatformPostCapability(eligibility.platform);
  const label = CONTENT_PLATFORM_LABELS[eligibility.platform];
  const overLimit = plainText.length > capability.maxCharacters;
  const presentation = presentEligibility(eligibility, label);
  const ToneIcon = TONE_ICONS[presentation.tone];

  return (
    <article className="space-y-2 rounded-xl border p-3">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{label}</h3>
        <span
          className={`text-xs tabular-nums ${
            overLimit ? toneClassName("warning") : "text-muted-foreground"
          }`}
        >
          {plainText.length.toLocaleString()} /{" "}
          {capability.maxCharacters.toLocaleString()}
        </span>
      </header>

      <p className="max-h-48 overflow-y-auto rounded-lg bg-muted/40 p-2 text-sm whitespace-pre-wrap">
        {plainText === "" ? (
          <span className="text-muted-foreground">Nothing to send yet.</span>
        ) : (
          plainText
        )}
      </p>

      <div
        className={`flex items-start gap-1.5 text-xs ${presentation.containerClassName}`}
      >
        <ToneIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <div className="min-w-0 space-y-0.5">
          <p>{presentation.message}</p>
          {/* The "why" inherits the tone at reduced emphasis rather than taking
              a muted grey, which would lose contrast against a tinted fill. It
              explains and asks for nothing, so it must not compete with the
              requirement above it. */}
          {presentation.detail ? (
            <p className="opacity-80">{presentation.detail}</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
