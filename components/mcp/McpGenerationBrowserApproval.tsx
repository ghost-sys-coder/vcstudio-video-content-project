"use client";
import { useActionState } from "react";
import type { McpPublicOperation } from "@studio/contracts";
import type { GenerationPreview } from "@studio/contracts/mcp-generation";
import { Button } from "@/components/ui/button";
import { decideMcpOperationAction } from "@/app/(authenticated)/app/mcp/operations/[operationId]/actions";
import { GenerationReview } from "./GenerationReview";
export function McpGenerationBrowserApproval({
  operation,
  preview,
}: {
  operation: McpPublicOperation;
  preview: GenerationPreview;
}) {
  const [state, action, pending] = useActionState(decideMcpOperationAction, {
    ok: false,
    message: "",
  });
  const expired = new Date(operation.expiresAt) <= new Date();
  return (
    <GenerationReview
      preview={preview}
      autonomous={operation.status === "prepared"}
      actions={
        operation.status === "prepared" ? (
          <p role="status" className="text-sm">
            No generation has started. Your trusted assistant can execute this
            preparation through MCP.
          </p>
        ) : (
          <form action={action} className="app-section">
            <input type="hidden" name="operationId" value={operation.id} />
            <input
              type="hidden"
              name="workspaceId"
              value={operation.workspaceId}
            />
            <div className="flex flex-wrap gap-3">
              <Button
                name="decision"
                value="approve"
                type="submit"
                disabled={pending || state.ok || expired}
              >
                {pending ? "Processing…" : "Approve generation"}
              </Button>
              <Button
                variant="outline"
                name="decision"
                value="cancel"
                type="submit"
                disabled={pending || state.ok}
              >
                Cancel request
              </Button>
            </div>
            {expired && (
              <p role="alert">
                This preview expired. Ask the assistant to prepare a fresh
                generation.
              </p>
            )}
            {state.message && (
              <p role={state.ok ? "status" : "alert"}>{state.message}</p>
            )}
          </form>
        )
      }
    />
  );
}
