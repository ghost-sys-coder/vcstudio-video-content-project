"use client";
import { Button } from "@/components/ui/button";
import { PublicationReview } from "./PublicationReview";
import { useMcpReview } from "@/hooks/useMcpReview";
export function McpReviewWidget() {
  const review = useMcpReview();
  if (!review.data)
    return (
      <main className="app-panel">
        <p role="status">{review.message || "Loading publication review…"}</p>
      </main>
    );
  return (
    <main className="app-page">
      <PublicationReview
        preview={review.data.preview}
        mediaPreviews={review.mediaPreviews}
        actions={
          <div className="app-section">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={
                  !review.canApprove || review.pending || review.complete
                }
                onClick={review.approve}
              >
                {review.pending
                  ? "Processing…"
                  : review.data.preview.action === "cancel_schedule"
                    ? "Approve cancellation"
                    : review.data.preview.scheduledAt
                      ? "Approve schedule"
                      : "Approve publication"}
              </Button>
              <a
                className="underline"
                href={review.data.approvalUrl}
                target="_blank"
                rel="noreferrer"
              >
                Review in VCStudio
              </a>
            </div>
            {review.message && <p role="status">{review.message}</p>}
            {!review.canApprove && !review.complete && (
              <p className="text-sm text-muted-foreground">
                Open the VCStudio review page to approve this request.
              </p>
            )}
          </div>
        }
      />
    </main>
  );
}
