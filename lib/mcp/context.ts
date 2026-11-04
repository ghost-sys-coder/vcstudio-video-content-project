import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import type { McpPrincipal, McpScope } from "@studio/contracts";
import {
  ensureMcpConnection,
  findMcpConnection,
  findMcpGrant,
} from "@/db/repositories/mcp.repository";
import {
  findActiveUserByClerkId,
  upsertSynchronizedUser,
} from "@/db/repositories/users.repository";
import { findWorkspaceMembership } from "@/db/repositories/workspaces.repository";
import { profileFromClerkUser } from "@/lib/auth/clerk-profile";
import { getMcpEnvironment } from "@/lib/env/server";
import { McpError, requireMcp } from "./errors";
import { assertMcpAccess } from "./policy";
import { assertMcpTokenResource } from "./token-resource";
import { mcpBaseUrl } from "./config";

export function requireMcpEnabled() {
  requireMcp(
    getMcpEnvironment().ENABLE_MCP,
    "feature_disabled",
    "MCP is disabled in this deployment.",
  );
}
export async function authenticateMcp(): Promise<McpPrincipal> {
  requireMcpEnabled();
  const token = await auth({ acceptsToken: "oauth_token" });
  requireMcp(
    token.isAuthenticated && token.userId && token.clientId,
    "unauthenticated",
    "Connect VCStudio with your own account.",
  );
  assertMcpTokenResource(await token.getToken(), `${mcpBaseUrl()}/mcp`);
  const clerk = await clerkClient();
  const verified = await clerk.idPOAuthAccessToken
    .verify(await token.getToken())
    .catch(() => {
      throw new McpError(
        "unauthenticated",
        "This OAuth authorization is invalid. Reconnect your account.",
      );
    });
  requireMcp(
    !verified.revoked &&
      !verified.expired &&
      verified.clientId === token.clientId &&
      verified.subject === token.userId,
    "unauthenticated",
    "This OAuth authorization expired or was revoked. Reconnect your account.",
  );
  const user =
    (await findActiveUserByClerkId(token.userId)) ??
    (await upsertSynchronizedUser(
      profileFromClerkUser(await clerk.users.getUser(token.userId)),
    ));
  return {
    userId: user.id,
    clerkUserId: token.userId,
    clientId: token.clientId,
    scopes: token.scopes,
  };
}
export async function authorizeMcp(
  principal: McpPrincipal,
  workspaceId: string,
  scope: McpScope,
) {
  requireMcpEnabled();
  const connection = await ensureMcpConnection(
    principal.userId,
    principal.clientId,
  );
  const [grant, membership] = await Promise.all([
    findMcpGrant(connection.id, workspaceId),
    findWorkspaceMembership({ userId: principal.userId, workspaceId }),
  ]);
  requireMcp(
    grant && membership,
    "permission_denied",
    "Authorize this workspace in AI connections before using it.",
  );
  assertMcpAccess({
    role: membership.role,
    tokenScopes: principal.scopes,
    grantedScopes: grant.scopes,
    scope,
    revoked: !!connection.revokedAt,
  });
  return { principal, workspaceId, connection, membership, grant };
}
export type McpContext = Awaited<ReturnType<typeof authorizeMcp>>;
export async function authorizeMcpBrowser(
  userId: string,
  connectionId: string,
  workspaceId: string,
  scope: McpScope,
) {
  const connection = await findMcpConnection(connectionId, userId);
  requireMcp(
    connection,
    "permission_denied",
    "This AI connection is unavailable.",
  );
  const grant = await findMcpGrant(connection.id, workspaceId);
  requireMcp(
    grant,
    "permission_denied",
    "This workspace has not been authorized.",
  );
  // Browser approval cannot broaden the OAuth client's grants.
  return authorizeMcp(
    {
      userId,
      clerkUserId: "browser",
      clientId: connection.clientId,
      scopes: grant.scopes,
    },
    workspaceId,
    scope,
  );
}
