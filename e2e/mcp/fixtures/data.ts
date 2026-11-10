import { MCP_SCOPES, type PublicationPreview } from "@studio/contracts";
import type { McpSettingsView } from "@/lib/mcp/settings-view";
export const workspaceId = "11111111-1111-4111-8111-111111111111";
export const operationId = "22222222-2222-4222-8222-222222222222";
export const mediaId = "77777777-7777-4777-8777-777777777777";
export const mediaOrigin = "https://studio.account.r2.example";
export const preview: PublicationPreview = {
  postId: "33333333-3333-4333-8333-333333333333",
  version: 2,
  text: "An existing image, brought in from an AI conversation.",
  media: [],
  destinations: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      platform: "linkedin",
      name: "My connected profile",
      text: "An existing image, brought in from an AI conversation.",
    },
  ],
  scheduledAt: "2026-12-15T09:00:00.000Z",
  timezone: "Africa/Kampala",
};
export const settings: McpSettingsView = {
  enabled: true,
  endpoint: "https://vcstudio.example/mcp",
  activeWorkspaceId: workspaceId,
  workspaces: [
    {
      workspaceId,
      workspaceName: "Production workspace",
      workspaceSlug: "production",
      role: "owner",
      allowedScopes: [...MCP_SCOPES],
    },
  ],
  connections: [
    {
      id: operationId,
      clientId: "https://ai.example/client-metadata.json",
      revoked: false,
      grants: [],
    },
  ],
  activity: [],
};

export const populatedSettings: McpSettingsView = {
  ...settings,
  workspaces: [
    ...settings.workspaces,
    {
      workspaceId: "99999999-9999-4999-8999-999999999999",
      workspaceName: "Reference workspace",
      workspaceSlug: "reference",
      role: "viewer",
      allowedScopes: ["vcstudio:read"],
    },
  ],
  connections: [
    {
      ...settings.connections[0],
      clientId: "https://chatgpt.com/connector/client-metadata.json",
      grants: [
        {
          connectionId: operationId,
          workspaceId,
          scopes: [...MCP_SCOPES],
          publicationApprovalMode: "manual",
          generationApprovalMode: "manual",
          createdAt: new Date("2026-11-05T08:00:00Z"),
          updatedAt: new Date("2026-11-05T08:00:00Z"),
        },
      ],
    },
    {
      id: "66666666-6666-4666-8666-666666666666",
      clientId:
        "https://claude.ai/" +
        "long-client-identifier/".repeat(6) +
        "client-metadata.json",
      revoked: true,
      grants: [],
    },
  ],
  activity: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      kind: "import_asset",
      status: "succeeded",
      error: null,
      createdAt: "2026-11-05T08:00:00.000Z",
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      kind: "publish_post",
      status: "requires_approval",
      error: null,
      createdAt: "2026-11-05T07:50:00.000Z",
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      kind: "import_asset",
      status: "failed",
      error:
        "This download link expired. Start a new import with a fresh link.",
      createdAt: "2026-11-05T07:40:00.000Z",
    },
  ],
};
