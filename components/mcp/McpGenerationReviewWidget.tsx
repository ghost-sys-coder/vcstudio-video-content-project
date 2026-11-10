"use client";
import { Button } from "@/components/ui/button";
import { useMcpGenerationReview } from "@/hooks/useMcpGenerationReview";
import { GenerationReview } from "./GenerationReview";
export function McpGenerationReviewWidget() {
  const review = useMcpGenerationReview();
  if (!review.data)
    return (
      <main className="app-panel">
        <p role="status">{review.message || "Loading generation review…"}</p>
      </main>
    );
  const autonomous = review.data.operation.status === "prepared";
  return (
    <main className="app-page">
      <GenerationReview
        preview={review.data.preview}
        autonomous={autonomous}
        actions={
          <div className="app-section">
            {autonomous ? (
              <p role="status">
                No generation has started. Your authorized assistant can call
                execute_generation with this preparation.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={
                    !review.canApprove || review.pending || review.complete
                  }
                  onClick={review.approve}
                >
                  {review.pending ? "Processing…" : "Approve generation"}
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
            )}
            {review.message && <p role="status">{review.message}</p>}
          </div>
        }
      />
    </main>
  );
}
