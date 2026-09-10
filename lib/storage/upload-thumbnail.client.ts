import type { ContentPlatform } from "@/db/schema";

/**
 * Uploads a thumbnail the creator already has, in the same three steps as a
 * scene image: authorize, PUT straight to storage, then finalize.
 *
 * The file never passes through the application server, which is what keeps a
 * large image off the request path, and the signed URL is scoped to one object
 * key, one content type and one length.
 */
export async function uploadThumbnail(input: {
  projectId: string;
  platform: ContentPlatform;
  file: File;
}): Promise<{ thumbnailGenerationId: string }> {
  const base = `/api/projects/${input.projectId}/thumbnails`;
  const authorization = await fetch(`${base}/upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      platform: input.platform,
      contentType: input.file.type,
      fileName: input.file.name,
      sizeBytes: input.file.size,
    }),
  });
  if (!authorization.ok)
    throw new Error(
      (await authorization.json()).error ?? "Upload authorization failed.",
    );
  const upload = (await authorization.json()) as {
    objectKey: string;
    uploadUrl: string;
    thumbnailGenerationId: string;
  };

  let uploaded: Response;
  try {
    uploaded = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "content-type": input.file.type },
      body: input.file,
    });
  } catch {
    throw new Error(
      "The storage service blocked the upload. Verify that this site is allowed by the bucket CORS policy.",
    );
  }
  if (!uploaded.ok)
    throw new Error(
      `The storage service rejected the upload (HTTP ${uploaded.status}).`,
    );

  const completion = await fetch(`${base}/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      platform: input.platform,
      thumbnailGenerationId: upload.thumbnailGenerationId,
      objectKey: upload.objectKey,
      contentType: input.file.type,
      sizeBytes: input.file.size,
    }),
  });
  if (!completion.ok)
    throw new Error(
      (await completion.json()).error ?? "Upload finalization failed.",
    );
  return (await completion.json()) as { thumbnailGenerationId: string };
}
