"use client";

import { AlertTriangleIcon, CheckIcon, InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EditorialReviewView } from "@/lib/editorial/editorial-review-view";

const HEADLINES = {
  none: "Nobody has signed off on this review.",
  current: "Signed off against this exact script.",
  edited: "Signed off, but the script has changed since.",
  invalidated: "The sign-off has been withdrawn by later changes.",
} as const;

/**
 * Whether a sign-off still describes the script in front of you.
 *
 * Four states and not two, because "signed off" and "not signed off" cannot
 * express the case this slice cares about most: a sign-off that was genuine
 * when it was made and has since been outgrown by the draft. Each reason is
 * listed literally, so a reviewer can see which sentence broke it rather than
 * being told to start over.
 */
export function EditorialSignoffNotice({
  view,
  canEdit,
  busy,
  onSignOff,
}: {
  view: EditorialReviewView;
  canEdit: boolean;
  busy: boolean;
  onSignOff: () => void;
}) {
  const status = view.signoff.status;
  const settled = status === "current";
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <p
        className={`flex items-start gap-1.5 text-sm font-medium ${
          status === "invalidated"
            ? "text-amber-600 dark:text-amber-400"
            : settled
              ? "text-emerald-700 dark:text-emerald-400"
              : ""
        }`}
      >
        {settled ? (
          <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        ) : status === "none" ? (
          <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        ) : (
          <AlertTriangleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        )}
        {HEADLINES[status]}
      </p>
      <p className="text-xs text-muted-foreground">{view.readiness}</p>
      {view.signoff.reasons.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {view.signoff.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}
      {canEdit ? (
        <Button
          disabled={busy || settled}
          onClick={onSignOff}
          size="sm"
          type="button"
          variant={status === "current" ? "outline" : "default"}
        >
          {status === "none" ? "Sign off on this review" : "Sign off again"}
        </Button>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Signing off records that you checked these claims against these sources.
        It does not check anything, and it does not block approving the script.
      </p>
    </div>
  );
}
