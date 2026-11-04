"use client";
import { useActionState } from "react";
import type { PublicationPreview } from "@studio/contracts";
import { Button } from "@/components/ui/button";
import { PublicationReview } from "./PublicationReview";
import { decideMcpOperationAction } from "@/app/(authenticated)/app/mcp/operations/[operationId]/actions";
import type { McpMediaPreview } from "@/lib/mcp/media-previews";
export function McpBrowserApproval({
  operationId,
  workspaceId,
  preview,
  expired,
  mediaPreviews,
}: {
  operationId: string;
  workspaceId: string;
  preview: PublicationPreview;
  expired: boolean;
  mediaPreviews?: McpMediaPreview[];
}) {
  const [state, action, pending] = useActionState(decideMcpOperationAction, {
    ok: false,
    message: "",
  });
  return (
    <PublicationReview
      preview={preview}
      mediaPreviews={mediaPreviews}
      actions={
        <form action={action} className="app-section">
          <input type="hidden" name="operationId" value={operationId} />
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <div className="flex flex-wrap gap-3">
            <Button
              name="decision"
              value="approve"
              type="submit"
              disabled={expired || pending || state.ok}
            >
              {pending
                ? "Processing…"
                : preview.action === "cancel_schedule"
                  ? "Approve cancellation"
                  : preview.scheduledAt
                    ? "Approve schedule"
                    : "Approve publication"}
            </Button>
            <Button
              name="decision"
              value="cancel"
              type="submit"
              variant="outline"
              disabled={pending || state.ok}
            >
              Cancel request
            </Button>
          </div>
          {expired && (
            <p role="alert">
              This approval expired. Ask the assistant to prepare a fresh
              preview.
            </p>
          )}
          {state.message && (
            <p role={state.ok ? "status" : "alert"}>{state.message}</p>
          )}
        </form>
      }
    />
  );
}
