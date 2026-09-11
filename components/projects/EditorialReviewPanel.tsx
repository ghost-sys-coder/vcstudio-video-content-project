"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { normalizeNarrationText } from "@/lib/domain/narration-normalization";
import { AddEditorialSourceForm } from "@/components/projects/AddEditorialSourceForm";
import { ClaimCandidateList } from "@/components/projects/ClaimCandidateList";
import { EditorialClaimCard } from "@/components/projects/EditorialClaimCard";
import { EditorialSignoffNotice } from "@/components/projects/EditorialSignoffNotice";
import { EditorialSourceList } from "@/components/projects/EditorialSourceList";
import {
  addProjectSourceAction,
  addScriptClaimAction,
  archiveProjectSourceAction,
  citeSourceForClaimAction,
  deleteScriptClaimAction,
  removeClaimCitationAction,
  reviewScriptClaimAction,
  signOffEditorialReviewAction,
  type EditorialActionResult,
} from "@/app/(authenticated)/app/projects/[projectId]/script/evidence-actions";
import type { ClaimCandidate } from "@/lib/editorial/claim-candidates";
import type { ClaimReviewState } from "@/lib/editorial/editorial-review";
import type { EditorialReviewView } from "@/lib/editorial/editorial-review-view";

/**
 * Source-backed review of the factual claims in a script.
 *
 * The panel deliberately never reports on accuracy. It reports on *coverage*:
 * which sentences someone looked at, what they concluded, and what they cited.
 * Everything it shows is a record of human work, which is why no control here
 * spends money, calls a provider, or blocks approval. A reviewer who ignores it
 * entirely still gets an honest answer, namely that nothing was checked.
 *
 * Candidates are computed from the last saved draft on the server. Unsaved
 * typing is therefore not reflected until autosave lands, which the heading
 * says rather than hides; anchoring works the same way, so a claim never looks
 * current because of text that only exists in one browser tab.
 */
export function EditorialReviewPanel({
  projectId,
  view,
  candidates,
  canEdit,
}: {
  projectId: string;
  view: EditorialReviewView;
  candidates: ClaimCandidate[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function run(action: () => Promise<EditorialActionResult>) {
    startTransition(async () => {
      const result = await action();
      setMessage(result.status === "error" ? result.message : null);
      if (result.status === "ok") router.refresh();
    });
  }

  // Compared after normalization, because a stored quote has been through the
  // sanitizer and a candidate has not. A whitespace difference must not make a
  // sentence look untracked and invite a duplicate claim.
  const trackedQuotes = new Set(
    view.claims.map((claim) => normalizeNarrationText(claim.quotedText)),
  );
  const untracked = candidates.filter(
    (candidate) => !trackedQuotes.has(normalizeNarrationText(candidate.text)),
  );

  return (
    <section className="space-y-4 rounded-xl border p-4" id="editorial-review">
      <div>
        <h2 className="text-sm font-semibold">Claim review</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Track the factual claims in this script and the sources you checked
          them against. This app does not verify anything and does not read your
          sources. It records what you reviewed and shows what you did not.
        </p>
      </div>

      {message ? (
        <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
          {message}
        </p>
      ) : null}

      <EditorialSignoffNotice
        busy={pending}
        canEdit={canEdit}
        onSignOff={() =>
          run(() =>
            signOffEditorialReviewAction({
              projectId,
              scriptFingerprint: view.scriptFingerprint,
              note: "",
            }),
          )
        }
        view={view}
      />

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Claims
        </h3>
        {view.claims.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No claims are being tracked yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {view.claims.map((claim) => (
              <EditorialClaimCard
                busy={pending}
                canEdit={canEdit}
                claim={claim}
                key={claim.id}
                onCite={(claimId, sourceId, stance) =>
                  run(() =>
                    citeSourceForClaimAction({
                      projectId,
                      claimId,
                      sourceId,
                      stance,
                      excerpt: "",
                    }),
                  )
                }
                onDelete={(claimId) =>
                  run(() => deleteScriptClaimAction({ projectId, claimId }))
                }
                onRemoveCitation={(claimId, sourceId) =>
                  run(() =>
                    removeClaimCitationAction({ projectId, claimId, sourceId }),
                  )
                }
                onReview={(claimId, reviewState: ClaimReviewState) =>
                  run(() =>
                    reviewScriptClaimAction({
                      projectId,
                      claimId,
                      reviewState,
                      reviewNote: "",
                    }),
                  )
                }
                sources={view.sources}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Suggested from the saved draft
        </h3>
        <ClaimCandidateList
          busy={pending}
          canEdit={canEdit}
          candidates={untracked}
          onTrack={(quotedText) =>
            run(() => addScriptClaimAction({ projectId, quotedText }))
          }
        />
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sources
        </h3>
        <EditorialSourceList
          busy={pending}
          canEdit={canEdit}
          onArchive={(sourceId) =>
            run(() => archiveProjectSourceAction({ projectId, sourceId }))
          }
          sources={view.sources}
        />
        {canEdit ? (
          <AddEditorialSourceForm
            busy={pending}
            onAdd={async (input) => {
              const result = await addProjectSourceAction({
                projectId,
                ...input,
              });
              setMessage(result.status === "error" ? result.message : null);
              if (result.status === "error") return false;
              router.refresh();
              return true;
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
