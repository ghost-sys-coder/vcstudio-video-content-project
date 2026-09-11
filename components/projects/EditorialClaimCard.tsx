"use client";

import { AlertTriangleIcon, LinkIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  EditorialClaimView,
  EditorialSourceView,
} from "@/lib/editorial/editorial-review-view";
import type { ClaimReviewState } from "@/lib/editorial/editorial-review";

const STATE_OPTIONS: { value: ClaimReviewState; label: string }[] = [
  { value: "unchecked", label: "Unchecked" },
  { value: "supported", label: "Supported" },
  { value: "disputed", label: "Disputed" },
];

const STATE_CLASSES: Record<ClaimReviewState, string> = {
  unchecked: "border-amber-500/60 bg-amber-500/10 text-amber-700",
  supported: "border-emerald-500/60 bg-emerald-500/10 text-emerald-700",
  disputed: "border-rose-500/60 bg-rose-500/10 text-rose-700",
};

/**
 * One claim, its verdict, and the sources cited for and against it.
 *
 * The three states are shown as three equal choices rather than a checkbox,
 * because "unchecked" is a real answer and must stay as visible as the other
 * two. A review interface that only offers "mark as checked" turns everything
 * nobody reached into an invisible pass.
 */
export function EditorialClaimCard({
  claim,
  sources,
  canEdit,
  busy,
  onReview,
  onCite,
  onRemoveCitation,
  onDelete,
}: {
  claim: EditorialClaimView;
  sources: EditorialSourceView[];
  canEdit: boolean;
  busy: boolean;
  onReview: (claimId: string, state: ClaimReviewState) => void;
  onCite: (
    claimId: string,
    sourceId: string,
    stance: "supports" | "disputes",
  ) => void;
  onRemoveCitation: (claimId: string, sourceId: string) => void;
  onDelete: (claimId: string) => void;
}) {
  const uncited = sources.filter(
    (source) =>
      !claim.citations.some((citation) => citation.sourceId === source.id),
  );
  return (
    <li className="space-y-3 rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <blockquote className="min-w-0 border-l-2 pl-3 text-sm italic">
          {claim.quotedText}
        </blockquote>
        {canEdit ? (
          <Button
            aria-label="Remove this claim"
            disabled={busy}
            onClick={() => onDelete(claim.id)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Trash2Icon aria-hidden className="size-4" />
          </Button>
        ) : null}
      </div>

      {claim.anchored ? null : (
        <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangleIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          This sentence is no longer in the script. The review below describes
          text that has been edited or removed, so it needs redoing.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {STATE_OPTIONS.map((option) => (
          <label
            className={`cursor-pointer rounded-lg border px-3 py-1 text-xs transition-colors ${
              claim.reviewState === option.value
                ? STATE_CLASSES[option.value]
                : "hover:bg-muted"
            } ${canEdit ? "" : "pointer-events-none opacity-70"}`}
            key={option.value}
          >
            <input
              checked={claim.reviewState === option.value}
              className="sr-only"
              disabled={!canEdit || busy}
              name={`claim-${claim.id}-state`}
              onChange={() => onReview(claim.id, option.value)}
              type="radio"
            />
            {option.label}
          </label>
        ))}
      </div>

      {claim.reviewNote ? (
        <p className="text-xs text-muted-foreground">{claim.reviewNote}</p>
      ) : null}

      {claim.citations.length > 0 ? (
        <ul className="space-y-1.5">
          {claim.citations.map((citation) => (
            <li
              className="flex items-start justify-between gap-2 text-xs"
              key={citation.sourceId}
            >
              <span className="min-w-0">
                <span
                  className={
                    citation.stance === "supports"
                      ? "font-medium text-emerald-700 dark:text-emerald-400"
                      : "font-medium text-rose-700 dark:text-rose-400"
                  }
                >
                  {citation.stance === "supports" ? "Supports" : "Disputes"}
                </span>{" "}
                {citation.url ? (
                  <a
                    className="underline underline-offset-2"
                    href={citation.url}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                  >
                    {citation.title}
                  </a>
                ) : (
                  citation.title
                )}
                {citation.host ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {citation.host}
                  </span>
                ) : null}
                {citation.archived ? (
                  <span className="text-muted-foreground"> · archived</span>
                ) : null}
                {citation.excerpt ? (
                  <span className="block text-muted-foreground">
                    {citation.excerpt}
                  </span>
                ) : null}
              </span>
              {canEdit ? (
                <Button
                  disabled={busy}
                  onClick={() => onRemoveCitation(claim.id, citation.sourceId)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {canEdit && uncited.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <LinkIcon aria-hidden className="size-3.5 text-muted-foreground" />
          <label className="sr-only" htmlFor={`cite-${claim.id}`}>
            Cite a source for this claim
          </label>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
            defaultValue=""
            disabled={busy}
            id={`cite-${claim.id}`}
            onChange={(event) => {
              const [sourceId, stance] = event.target.value.split("|");
              if (sourceId && (stance === "supports" || stance === "disputes"))
                onCite(claim.id, sourceId, stance);
              event.target.value = "";
            }}
          >
            <option value="">Cite a source…</option>
            {uncited.map((source) => (
              <optgroup key={source.id} label={source.title}>
                <option value={`${source.id}|supports`}>
                  Supports this claim
                </option>
                <option value={`${source.id}|disputes`}>
                  Disputes this claim
                </option>
              </optgroup>
            ))}
          </select>
        </div>
      ) : null}
    </li>
  );
}
