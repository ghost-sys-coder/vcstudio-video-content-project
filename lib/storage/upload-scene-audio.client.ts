export async function uploadSceneAudioRecording(input: {
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  blob: Blob;
  contentType: "audio/webm" | "audio/mp4";
  durationMilliseconds: number;
}): Promise<{ generationId: string }> {
  const base = `/api/projects/${input.projectId}/scene-audio/recordings`;
  const fileName = `recording.${input.contentType === "audio/mp4" ? "m4a" : "webm"}`;
  const authorization = await fetch(`${base}/upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sceneId: input.sceneId,
      sceneVersionId: input.sceneVersionId,
      contentType: input.contentType,
      fileName,
      sizeBytes: input.blob.size,
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
      headers: { "content-type": input.contentType },
      body: input.blob,
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
      objectKey: upload.objectKey,
      contentType: input.contentType,
      sizeBytes: input.blob.size,
      durationMilliseconds: Math.round(input.durationMilliseconds),
    }),
  });
  if (!completion.ok)
    throw new Error(
      (await completion.json()).error ?? "Upload finalization failed.",
    );
  return (await completion.json()) as { generationId: string };
}
