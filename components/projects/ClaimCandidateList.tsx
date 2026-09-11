"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CLAIM_CANDIDATE_GUIDANCE,
  describeClaimSignals,
  type ClaimCandidate,
} from "@/lib/editorial/claim-candidates";

/**
 * Sentences that look like they contain checkable facts.
 *
 * The guidance line is not decoration. This list is produced by matching
 * characters, so it can miss a claim entirely and can flag a sentence that
 * asserts nothing. Presenting it without saying so would let an empty list read
 * as a clean bill of health, which is the exact confusion this slice removes.
 */
export function ClaimCandidateList({
  candidates,
  canEdit,
  busy,
  onTrack,
}: {
  candidates: ClaimCandidate[];
  canEdit: boolean;
  busy: boolean;
  onTrack: (text: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {CLAIM_CANDIDATE_GUIDANCE}
      </p>
      {candidates.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing matched. That is not a result: add any sentence you want
          reviewed by pasting it in above.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {candidates.map((candidate) => (
            <li
              className="flex items-start justify-between gap-2 rounded-lg border p-2.5 text-xs"
              key={`${candidate.offset}:${candidate.text}`}
            >
              <span className="min-w-0">
                {candidate.text}
                <span className="mt-0.5 block text-muted-foreground">
                  {describeClaimSignals(candidate.signals)}
                </span>
              </span>
              {canEdit ? (
                <Button
                  disabled={busy}
                  onClick={() => onTrack(candidate.text)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <PlusIcon aria-hidden className="size-3.5" />
                  Review
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
