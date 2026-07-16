import type { CharacterReferenceType } from "@/db/schema";

export async function uploadCharacterReference(input: {
  workspaceId: string;
  characterId: string;
  type: CharacterReferenceType;
  file: File;
}) {
  const base = `/api/workspaces/${input.workspaceId}/characters/${input.characterId}/references`;
  const authorization = await fetch(`${base}/upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      type: input.type,
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
      type: input.type,
      objectKey: upload.objectKey,
      contentType: input.file.type,
      sizeBytes: input.file.size,
    }),
  });
  if (!completion.ok)
    throw new Error(
      (await completion.json()).error ?? "Upload finalization failed.",
    );
}
