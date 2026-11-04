"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { MCP_SCOPES, mcpScopeSchema } from "@studio/contracts";
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
export type McpFormState = { ok: boolean; message: string };
export async function saveMcpGrantAction(
  _previous: McpFormState,
  form: FormData,
): Promise<McpFormState> {
  try {
    requireMcpEnabled();
    const user = await requireAuthenticatedUser();
    const p = z
      .object({
        connectionId: z.uuid(),
        workspaceId: z.uuid(),
        scopes: z.array(mcpScopeSchema).max(MCP_SCOPES.length),
      })
      .parse({
        connectionId: form.get("connectionId"),
        workspaceId: form.get("workspaceId"),
        scopes: form.getAll("scopes"),
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
    await saveMcpGrant({ ...p, userId: user.id });
    await recordAuditEvent({
      workspaceId: p.workspaceId,
      actorUserId: user.id,
      action: "mcp_connection_changed",
      targetType: "mcp_connection",
      targetId: p.connectionId,
      metadata: { event: "workspace_grant_saved", scopes: p.scopes },
    });
    revalidatePath("/app/settings/mcp");
    return {
      ok: true,
      message:
        "Workspace permissions saved. The client must also authorize the matching OAuth scopes.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Permissions could not be saved. Check your membership and try again.",
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
