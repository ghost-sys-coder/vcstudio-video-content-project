import { McpSettingsPage } from "@/components/mcp/McpSettingsPage";
import { McpUploadPanel } from "@/components/mcp/McpUploadPanel";
import { McpBrowserApproval } from "@/components/mcp/McpBrowserApproval";
import { settings, preview, workspaceId, operationId } from "./data";
export function McpUiHarness() {
  const mode = new URLSearchParams(location.search).get("mode");
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
  return <McpSettingsPage data={settings} />;
}
