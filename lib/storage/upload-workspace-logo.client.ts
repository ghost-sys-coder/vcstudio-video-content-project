export async function uploadWorkspaceLogo(input: {
  workspaceId: string;
  file: File;
}): Promise<void> {
  const authorization = await fetch(
    `/api/workspaces/${input.workspaceId}/logo/upload`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contentType: input.file.type,
        fileName: input.file.name,
        sizeBytes: input.file.size,
      }),
    },
  );
  if (!authorization.ok) throw new Error("Logo upload authorization failed.");

  const upload = (await authorization.json()) as {
    objectKey: string;
    uploadUrl: string;
  };
  const uploaded = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers: { "content-type": input.file.type },
    body: input.file,
  });
  if (!uploaded.ok) throw new Error("Logo upload failed.");

  const completion = await fetch(
    `/api/workspaces/${input.workspaceId}/logo/complete`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        objectKey: upload.objectKey,
        contentType: input.file.type,
        sizeBytes: input.file.size,
      }),
    },
  );
  if (!completion.ok) throw new Error("Logo upload finalization failed.");
}
