import "server-only";
import { MCP_SCOPES } from "@studio/contracts";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  listMcpConnections,
  listMcpGrants,
  listMcpActivity,
} from "@/db/repositories/mcp.repository";
import { getMcpEnvironment } from "@/lib/env/server";
import { roleAllowsScope } from "./policy";
import { mcpBaseUrl } from "./config";
export async function loadMcpSettings() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;
  const enabled = getMcpEnvironment().ENABLE_MCP;
  const connections = enabled ? await listMcpConnections(context.user.id) : [];
  const [grants, activity] = await Promise.all([
    Promise.all(connections.map((c) => listMcpGrants(c.id))),
    enabled
      ? listMcpActivity(context.user.id, context.activeMembership.workspaceId)
      : Promise.resolve([]),
  ]);
  return {
    enabled,
    endpoint: `${mcpBaseUrl()}/mcp`,
    activeWorkspaceId: context.activeMembership.workspaceId,
    workspaces: context.memberships.slice(0, 50).map((m) => ({
      ...m,
      allowedScopes: MCP_SCOPES.filter((scope) =>
        roleAllowsScope(m.role, scope),
      ),
    })),
    connections: connections.map((c, index) => ({
      id: c.id,
      clientId: c.clientId,
      revoked: !!c.revokedAt,
      grants: grants[index],
    })),
    activity: activity.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
export type McpSettingsView = NonNullable<
  Awaited<ReturnType<typeof loadMcpSettings>>
>;
