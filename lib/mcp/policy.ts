import { MCP_SCOPES, type McpScope } from "@studio/contracts";
import type { WorkspaceRole } from "@/db/schema";
import { can, type WorkspaceCapability } from "@/lib/policies/workspace-policy";
import { McpError, McpScopeError } from "./errors";

const capabilities: Record<McpScope, WorkspaceCapability | null> = {
  "vcstudio:read": null,
  "vcstudio:edit": "mutateWorkspaceData",
  "vcstudio:media": "manageMediaLibrary",
  "vcstudio:review": "reviewSceneImages",
  "vcstudio:publish": "publishPosts",
  "vcstudio:generate": "mutateWorkspaceData",
};
export function assertMcpAccess(input: {
  role: WorkspaceRole;
  tokenScopes: string[];
  grantedScopes: string[];
  scope: McpScope;
  revoked: boolean;
}) {
  if (input.revoked || !input.grantedScopes.includes(input.scope))
    throw new McpError(
      "permission_denied",
      "This connection does not have permission for that action. Review its workspace grants.",
    );
  const capability = capabilities[input.scope];
  if (capability && !can(input.role, capability))
    throw new McpError(
      "permission_denied",
      "Your current workspace role does not permit that action.",
    );
  // Reauthorization can fix a token scope, but cannot repair a revoked grant
  // or role denial. Never invite OAuth to override those application policies.
  if (!input.tokenScopes.includes(input.scope))
    throw new McpScopeError(
      input.scope,
      MCP_SCOPES.filter((scope) => input.tokenScopes.includes(scope)),
    );
}
export function roleAllowsScope(role: WorkspaceRole, scope: McpScope) {
  const capability = capabilities[scope];
  return !capability || can(role, capability);
}
