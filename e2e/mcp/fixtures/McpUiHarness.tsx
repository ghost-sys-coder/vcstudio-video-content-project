import { McpSettingsPage } from "@/components/mcp/McpSettingsPage";
import { McpUploadPanel } from "@/components/mcp/McpUploadPanel";
import { McpBrowserApproval } from "@/components/mcp/McpBrowserApproval";
import { McpGenerationBrowserApproval } from "@/components/mcp/McpGenerationBrowserApproval";
import {
  settings,
  populatedSettings,
  preview,
  workspaceId,
  operationId,
} from "./data";
const generationExpiry = new Date(Date.now() + 600000).toISOString();
export function McpUiHarness() {
  const mode = new URLSearchParams(location.search).get("mode");
  if (mode?.startsWith("generation"))
    return (
      <main className="app-page">
        <McpGenerationBrowserApproval
          operation={{
            id: operationId,
            workspaceId,
            kind: "generate_media",
            status:
              mode === "generation-auto" ? "prepared" : "requires_approval",
            result: null,
            error: null,
            href: `/app/mcp/operations/${operationId}`,
            expiresAt:
              mode === "generation-expired"
                ? new Date(0).toISOString()
                : generationExpiry,
          }}
          preview={{
            kind: mode === "generation-video" ? "video" : "image",
            title: "Business image",
            text: "A calm professional studio with natural light.\nKeep the whole composition visible.",
            model:
              mode === "generation-video" ? "Veo 3.1 Fast" : "fixture-image",
            provider: mode === "generation-video" ? "elevenlabs" : "openai",
            estimatedCostCents: 8,
            maximumCostCents: 20,
            projectId: null,
            sceneId: null,
            settings:
              mode === "generation-video"
                ? [
                    { label: "Output", value: "16:9 · 720p · 8s" },
                    { label: "Audio", value: "none" },
                  ]
                : [
                    { label: "Size", value: "1024x1024" },
                    { label: "Quality", value: "low" },
                  ],
          }}
        />
      </main>
    );
  if (mode === "upload")
    return (
      <main className="app-page">
        <McpUploadPanel
          operationId={operationId}
          workspaceId={workspaceId}
          destination="Production workspace media library"
        />
      </main>
    );
  if (mode === "approval")
    return (
      <main className="app-page">
        <McpBrowserApproval
          operationId={operationId}
          workspaceId={workspaceId}
          preview={preview}
          expired={false}
        />
      </main>
    );
  return (
    <McpSettingsPage
      data={
        mode === "settings-populated"
          ? populatedSettings
          : mode === "settings-empty"
            ? { ...settings, connections: [] }
            : mode === "settings-paused"
              ? { ...settings, enabled: false, connections: [] }
              : settings
      }
    />
  );
}
