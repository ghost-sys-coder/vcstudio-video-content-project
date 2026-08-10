import { DocumentUploadPanel } from "@/components/marketing/DocumentUploadPanel";
import { EmptyBrandListState } from "@/components/marketing/EmptyBrandListState";
import { KnowledgeDocumentRow } from "@/components/marketing/KnowledgeDocumentRow";
import { KnowledgeDocumentProcessingPoller } from "@/components/marketing/KnowledgeDocumentProcessingPoller";
import { getAuthenticatedWorkspaceContext } from "@/lib/auth/workspace-context";
import { loadMarketingAssetsView } from "@/lib/marketing/documents/documents-view";

export default async function MarketingDocumentsPage() {
  const context = await getAuthenticatedWorkspaceContext();
  if (!context) return null;

  const { workspaceId } = context.activeMembership;
  const view = await loadMarketingAssetsView({ workspaceId });

  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {view.documentCount} of {view.maxDocuments} documents ·{" "}
          <span className="tabular-nums">
            ~{view.includedTokenEstimate.toLocaleString()}
          </span>{" "}
          tokens included
        </p>
      </div>

      <DocumentUploadPanel workspaceId={workspaceId} />
      {view.documents.some(
        (document) =>
          document.status === "pending" || document.status === "extracting",
      ) ? (
        <KnowledgeDocumentProcessingPoller />
      ) : null}

      {view.documents.length === 0 ? (
        <EmptyBrandListState
          description="Add anything written that the studio should treat as fact — an About page, a positioning note, a pricing sheet. What it does not have, it will not claim."
          title="Nothing uploaded yet"
        />
      ) : (
        <ul className="space-y-3">
          {view.documents.map((document) => (
            <KnowledgeDocumentRow document={document} key={document.id} />
          ))}
        </ul>
      )}
    </div>
  );
}
