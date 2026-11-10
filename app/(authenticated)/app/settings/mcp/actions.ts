"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { mcpGrantInput } from "@studio/contracts";
import { requireAuthenticatedUser } from "@/lib/auth/require-authenticated-user";
import { requireWorkspaceMembership } from "@/lib/auth/workspace-context";
import {
  saveMcpGrant,
  revokeMcpConnection,
  listMcpGrants,
  findMcpConnection,
} from "@/db/repositories/mcp.repository";
import { recordAuditEvent } from "@/lib/audit/record-audit-event";
import { requireMcpEnabled } from "@/lib/mcp/context";
import { roleAllowsScope } from "@/lib/mcp/policy";
import { assertPublicationApprovalGrant } from "@/lib/mcp/publication-approval-policy";
import { assertGenerationApprovalGrant } from "@/lib/mcp/generation-approval-policy";
import { McpError } from "@/lib/mcp/errors";
export type McpFormState = { ok: boolean; message: string };
export async function saveMcpGrantAction(
  _previous: McpFormState,
  form: FormData,
): Promise<McpFormState> {
  try {
    requireMcpEnabled();
    const user = await requireAuthenticatedUser();
    const p = mcpGrantInput.parse({
      connectionId: form.get("connectionId"),
      workspaceId: form.get("workspaceId"),
      scopes: form.getAll("scopes"),
      publicationApprovalMode: form.get("publicationApprovalMode") ?? "manual",
      generationApprovalMode: form.get("generationApprovalMode") ?? "manual",
    });
    const membership = await requireWorkspaceMembership({
      userId: user.id,
      workspaceId: p.workspaceId,
    });
    if (p.scopes.some((s) => !roleAllowsScope(membership.role, s)))
      return {
        ok: false,
        message: "Your current role does not allow those permissions.",
      };
    assertPublicationApprovalGrant({ ...p, role: membership.role });
    assertGenerationApprovalGrant({ ...p, role: membership.role });
    await saveMcpGrant({ ...p, userId: user.id });
    await recordAuditEvent({
      workspaceId: p.workspaceId,
      actorUserId: user.id,
      action: "mcp_connection_changed",
      targetType: "mcp_connection",
      targetId: p.connectionId,
      metadata: {
        event: "workspace_grant_saved",
        scopes: p.scopes,
        publicationApprovalMode: p.publicationApprovalMode,
        generationApprovalMode: p.generationApprovalMode,
      },
    });
    revalidatePath("/app/settings/mcp");
    return {
      ok: true,
      message:
        "Workspace permissions saved. The client must also authorize the matching OAuth scopes.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof McpError
          ? error.message
          : "Permissions could not be saved. Check your membership and try again.",
    };
  }
}
export async function revokeMcpConnectionAction(
  _previous: McpFormState,
  form: FormData,
): Promise<McpFormState> {
  try {
    requireMcpEnabled();
    const user = await requireAuthenticatedUser();
    const connectionId = z.uuid().parse(form.get("connectionId"));
    if (!(await findMcpConnection(connectionId, user.id)))
      return { ok: false, message: "This connection is unavailable." };
    const grants = await listMcpGrants(connectionId);
    await revokeMcpConnection(connectionId, user.id);
    for (const grant of grants)
      await recordAuditEvent({
        workspaceId: grant.workspaceId,
        actorUserId: user.id,
        action: "mcp_connection_changed",
        targetType: "mcp_connection",
        targetId: connectionId,
        metadata: { event: "revoked" },
      });
    revalidatePath("/app/settings/mcp");
    return {
      ok: true,
      message:
        "AI connection disconnected. Approved Social schedules remain on the calendar.",
    };
  } catch {
    return {
      ok: false,
      message: "The connection could not be disconnected. Try again.",
    };
  }
}
