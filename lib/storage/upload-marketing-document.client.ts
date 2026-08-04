import type { MarketingDocumentContentType } from "@/lib/schemas/marketing-document";

/**
 * Uploads one knowledge document: authorize → PUT → confirm.
 *
 * The file never passes through the app server. Mirrors
 * `upload-media-asset.client.ts` step for step, including the CORS-shaped error
 * message — a thrown fetch on the PUT almost always means the bucket policy,
 * not the file.
 */
export async function uploadMarketingDocument(input: {
  workspaceId: string;
  title: string;
  file: File;
  contentType: MarketingDocumentContentType;
}): Promise<{ documentId: string; tokenEstimate: number }> {
  const authorize = await fetch(
    `/api/workspaces/${input.workspaceId}/marketing/documents/upload`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        fileName: input.file.name,
        contentType: input.contentType,
        sizeBytes: input.file.size,
      }),
    },
  );

  const authorized = (await authorize.json()) as {
    documentId?: string;
    uploadUrl?: string;
    error?: string;
  };
  if (!authorize.ok || !authorized.documentId || !authorized.uploadUrl)
    throw new Error(authorized.error ?? "That document could not be accepted.");

  let stored: Response;
  try {
    stored = await fetch(authorized.uploadUrl, {
      method: "PUT",
      headers: { "content-type": input.contentType },
      body: input.file,
    });
  } catch {
    throw new Error(
      "The upload could not reach storage. Check the bucket's CORS policy for this origin.",
    );
  }
  if (!stored.ok) throw new Error(`Upload failed (HTTP ${stored.status}).`);

  const complete = await fetch(
    `/api/workspaces/${input.workspaceId}/marketing/documents/complete`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        documentId: authorized.documentId,
        contentType: input.contentType,
      }),
    },
  );

  const completed = (await complete.json()) as {
    documentId?: string;
    tokenEstimate?: number;
    error?: string;
  };
  if (!complete.ok || !completed.documentId)
    throw new Error(completed.error ?? "That document could not be read.");

  return {
    documentId: completed.documentId,
    tokenEstimate: completed.tokenEstimate ?? 0,
  };
}
