"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadBrowserMcpOperation } from "@/lib/mcp/browser-operation";
import { approveMcpPublication } from "@/lib/mcp/publishing-service";
import { approveMcpGeneration } from "@/lib/mcp/generation-service";
import { updateMcpOperation } from "@/db/repositories/mcp.repository";
import { McpError } from "@/lib/mcp/errors";
export async function decideMcpOperationAction(
  _previous: { ok: boolean; message: string },
  form: FormData,
) {
  try {
    const p = z
      .object({
        operationId: z.uuid(),
        workspaceId: z.uuid(),
        decision: z.enum(["approve", "cancel"]),
      })
      .parse(Object.fromEntries(form));
    const { context, operation } = await loadBrowserMcpOperation(
      p.operationId,
      p.workspaceId,
    );
    if (p.decision === "approve") {
      if (operation.kind === "generate_media") {
        const result = await approveMcpGeneration(
          context,
          operation.id,
          undefined,
          true,
        );
        return {
          ok: !["failed", "expired", "cancelled"].includes(result.status),
          message:
            result.error ??
            "Generation authorized. Ask the assistant to check its progress.",
        };
      }
      const result = await approveMcpPublication(
        context,
        operation.id,
        undefined,
        true,
      );
      revalidatePath("/app/social/posts");
      revalidatePath("/app/social/calendar");
      return {
        ok: result.status === "succeeded",
        message:
          result.error ??
          "Approval recorded. Inspect the post for per-destination progress.",
      };
    }
    const cancelled = await updateMcpOperation({
      operationId: operation.id,
      workspaceId: p.workspaceId,
      from: ["requires_approval", "awaiting_upload", "queued"],
      values: { status: "cancelled", approvalHash: null, sealedSource: null },
    });
    if (!cancelled)
      return {
        ok: false,
        message:
          "This request already advanced. Check its current status before trying again.",
      };
    return {
      ok: true,
      message:
        operation.kind === "generate_media"
          ? "Request cancelled. No new generation will be started by this request."
          : "Request cancelled. No publication was started.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof McpError
          ? error.message
          : "This request could not be completed. Refresh its current state.",
    };
  }
}
