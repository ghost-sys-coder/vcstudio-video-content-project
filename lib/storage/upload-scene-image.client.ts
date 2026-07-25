import type { SceneImageApiSize } from "@/lib/schemas/scene-image";

export async function uploadSceneImage(input: {
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  size: SceneImageApiSize;
  file: File;
}): Promise<{ generationId: string }> {
  const base = `/api/projects/${input.projectId}/scene-images`;
  const authorization = await fetch(`${base}/upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sceneId: input.sceneId,
      sceneVersionId: input.sceneVersionId,
      size: input.size,
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
    generationId: string;
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
      sceneId: input.sceneId,
      sceneVersionId: input.sceneVersionId,
      generationId: upload.generationId,
      size: input.size,
      objectKey: upload.objectKey,
      contentType: input.file.type,
      sizeBytes: input.file.size,
    }),
  });
  if (!completion.ok)
    throw new Error(
      (await completion.json()).error ?? "Upload finalization failed.",
    );
  return (await completion.json()) as { generationId: string };
}
