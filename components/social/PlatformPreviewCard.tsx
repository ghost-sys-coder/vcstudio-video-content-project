"use client";

import { AlertCircleIcon, CheckCircle2Icon } from "lucide-react";
import { getPlatformPostCapability } from "@/lib/social/platform-post-capabilities";
import type { PlatformEligibility } from "@/lib/social/select-eligible-platforms";
import { CONTENT_PLATFORM_LABELS } from "@/lib/platforms/platform-labels";

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

  return (
    <article className="space-y-2 rounded-xl border p-3">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">{label}</h3>
        <span
          className={`text-xs tabular-nums ${overLimit ? "text-destructive" : "text-muted-foreground"}`}
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

      <p
        className={`flex items-start gap-1.5 text-xs ${
          eligibility.eligible ? "text-muted-foreground" : "text-destructive"
        }`}
      >
        {eligibility.eligible ? (
          <CheckCircle2Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        ) : (
          <AlertCircleIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        )}
        <span>
          {eligibility.eligible ? `Ready for ${label}.` : eligibility.reason}
        </span>
      </p>
    </article>
  );
}
