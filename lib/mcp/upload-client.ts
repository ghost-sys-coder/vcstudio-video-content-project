import { z } from "zod";
export async function uploadMcpFile(
  operationId: string,
  workspaceId: string,
  file: File,
) {
  const endpoint = `/api/mcp/uploads/${operationId}?workspaceId=${encodeURIComponent(workspaceId)}`;
  const authorize = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      step: "authorize",
      fileName: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    }),
  });
  if (!authorize.ok) {
    // Completion may have committed even if the browser lost its response.
    // A replay verifies the same operation and never uploads different bytes.
    const existing = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: "complete" }),
    });
    if (existing.ok) return;
    throw new Error(
      "Upload authorization failed. Check the file type, size and current connection permissions.",
    );
  }
  const data = z
    .object({ uploadUrl: z.string().url() })
    .parse(await authorize.json());
  const uploaded = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!uploaded.ok)
    throw new Error(
      "The upload was interrupted. Select the same file and retry.",
    );
  const complete = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step: "complete" }),
  });
  if (!complete.ok)
    throw new Error(
      "The file could not be verified. Inspect the operation and supply a fresh file if necessary.",
    );
}
