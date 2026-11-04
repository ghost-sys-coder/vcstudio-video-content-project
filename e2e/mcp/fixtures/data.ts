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
