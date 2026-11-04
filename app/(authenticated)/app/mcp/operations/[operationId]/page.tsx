import { notFound } from "next/navigation";
import { loadBrowserMcpOperation } from "@/lib/mcp/browser-operation";
import { publicOperation } from "@/lib/mcp/operations";
import { McpOperationPage } from "@/components/mcp/McpOperationPage";
import { loadMcpMediaPreviews } from "@/lib/mcp/media-previews";
import { publicationPreviewSchema } from "@studio/contracts";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ operationId: string }>;
  searchParams: Promise<{ workspaceId?: string }>;
}) {
  const { operationId } = await params;
  const { workspaceId } = await searchParams;
  if (!workspaceId) notFound();
  const loaded = await loadBrowserMcpOperation(operationId, workspaceId).catch(
    () => null,
  );
  if (!loaded) notFound();
  const preview = publicationPreviewSchema.safeParse(
    loaded.operation.input.preview,
  );
  const mediaPreviews =
    preview.success && loaded.operation.status === "requires_approval"
      ? await loadMcpMediaPreviews(workspaceId, preview.data)
      : [];
  return (
    <McpOperationPage
      operation={publicOperation(loaded.operation)}
      preview={loaded.operation.input.preview}
      mediaPreviews={mediaPreviews}
      destination="The workspace and destination selected in your AI conversation are retained for this request."
    />
  );
}
