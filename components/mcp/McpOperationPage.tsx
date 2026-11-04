import Link from "next/link";
import {
  publicationPreviewSchema,
  type McpPublicOperation,
} from "@studio/contracts";
import { McpBrowserApproval } from "./McpBrowserApproval";
import { McpUploadPanel } from "./McpUploadPanel";
import type { McpMediaPreview } from "@/lib/mcp/media-previews";
export function McpOperationPage({
  operation,
  preview,
  destination,
  mediaPreviews,
}: {
  operation: McpPublicOperation;
  preview: unknown;
  destination: string;
  mediaPreviews?: McpMediaPreview[];
}) {
  const parsed = publicationPreviewSchema.safeParse(preview);
  return (
    <div className="app-page">
      <header className="app-heading">
        <h1 className="text-2xl font-semibold">AI request</h1>
        <p className="text-sm text-muted-foreground">
          {operation.kind.replaceAll("_", " ")} · {operation.status}
        </p>
      </header>
      {operation.kind === "publish_post" &&
      operation.status === "requires_approval" &&
      parsed.success ? (
        <McpBrowserApproval
          operationId={operation.id}
          workspaceId={operation.workspaceId}
          preview={parsed.data}
          mediaPreviews={mediaPreviews}
          expired={new Date(operation.expiresAt) <= new Date()}
        />
      ) : operation.status === "awaiting_upload" ? (
        <McpUploadPanel
          operationId={operation.id}
          workspaceId={operation.workspaceId}
          destination={destination}
        />
      ) : (
        <section className="app-panel app-section">
          <p role="status">
            {operation.error ??
              (operation.status === "succeeded"
                ? "Request completed. Return to the assistant or inspect the content in VCStudio."
                : "Refresh this page or ask the assistant to check the operation when needed.")}
          </p>
          {operation.result &&
            typeof operation.result.href === "string" &&
            operation.result.href.startsWith("/app/") && (
              <Link className="underline" href={operation.result.href}>
                View content
              </Link>
            )}
          <Link className="underline" href="/app/settings/mcp">
            Manage AI connections
          </Link>
        </section>
      )}
    </div>
  );
}
