"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadBrowserMcpOperation } from "@/lib/mcp/browser-operation";
import { approveMcpPublication } from "@/lib/mcp/publishing-service";
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
    await updateMcpOperation({
      operationId: operation.id,
      workspaceId: p.workspaceId,
      from: ["requires_approval", "awaiting_upload", "queued"],
      values: { status: "cancelled", approvalHash: null, sealedSource: null },
    });
    return {
      ok: true,
      message: "Request cancelled. No publication was started.",
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
