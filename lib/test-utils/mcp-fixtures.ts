import type { McpContext } from "@/lib/mcp/context";
import type { McpOperation } from "@/db/repositories/mcp.repository";
import { MCP_SCOPES } from "@studio/contracts";
export const mcpIds = {
  workspace: "11111111-1111-4111-8111-111111111111",
  user: "22222222-2222-4222-8222-222222222222",
  connection: "33333333-3333-4333-8333-333333333333",
  operation: "44444444-4444-4444-8444-444444444444",
  post: "55555555-5555-4555-8555-555555555555",
  destination: "66666666-6666-4666-8666-666666666666",
  asset: "77777777-7777-4777-8777-777777777777",
};
export function mcpContextFixture(): McpContext {
  const now = new Date();
  return {
    workspaceId: mcpIds.workspace,
    principal: {
      userId: mcpIds.user,
      clerkUserId: "user_clerk",
      clientId: "https://client.example/metadata.json",
      scopes: [...MCP_SCOPES],
    },
    connection: {
      id: mcpIds.connection,
      userId: mcpIds.user,
      clientId: "https://client.example/metadata.json",
      revokedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    membership: {
      workspaceId: mcpIds.workspace,
      workspaceName: "Studio",
      workspaceSlug: "studio",
      role: "owner",
    },
    grant: {
      connectionId: mcpIds.connection,
      workspaceId: mcpIds.workspace,
      publicationApprovalMode: "manual",
      scopes: [...MCP_SCOPES],
      createdAt: now,
      updatedAt: now,
    },
  };
}
export function mcpOperationFixture(
  overrides: Partial<McpOperation> = {},
): McpOperation {
  const now = new Date();
  return {
    id: mcpIds.operation,
    workspaceId: mcpIds.workspace,
    userId: mcpIds.user,
    connectionId: mcpIds.connection,
    kind: "publish_post",
    idempotencyKey: "request-1234",
    fingerprint: "fingerprint",
    status: "requires_approval",
    input: {},
    result: null,
    error: null,
    approvalHash: "hash",
    sealedSource: null,
    triggerRunId: null,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + 600000),
    ...overrides,
  };
}
