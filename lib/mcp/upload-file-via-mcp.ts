import { z } from "zod";
import {
  mcpUploadSessionSchema,
  mcpUploadContentType,
  mcpUploadKey,
  MCP_UPLOAD_CHUNK_BYTES,
  type McpUploadSession,
} from "@studio/contracts/mcp-upload";
import { bytesSha256, uploadFileFingerprint } from "./upload-fingerprint";
export type McpUploadCaller = (
  name: string,
  args: Record<string, unknown>,
) => Promise<unknown>;
export class McpUploadClientError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function callUploadTool(
  call: McpUploadCaller,
  name: string,
  args: Record<string, unknown>,
) {
  const envelope = z
    .object({
      structuredContent: z.unknown().optional(),
      content: z
        .array(z.object({ type: z.string(), text: z.string().optional() }))
        .optional(),
      isError: z.boolean().optional(),
    })
    .parse(await call(name, args));
  const raw =
    envelope.structuredContent ??
    JSON.parse(
      envelope.content?.find((c) => c.type === "text")?.text ?? "null",
    );
  const result = z
    .discriminatedUnion("ok", [
      z.object({ ok: z.literal(true), data: z.unknown() }),
      z.object({ ok: z.literal(false), code: z.string(), message: z.string() }),
    ])
    .parse(raw);
  if (!result.ok) throw new McpUploadClientError(result.code, result.message);
  return result.data;
}
export function uploadFileContentType(file: File) {
  const hints: Record<string, string> = {
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };
  const parsed = mcpUploadContentType.safeParse(
    file.type || hints[file.name.split(".").pop()?.toLowerCase() ?? ""],
  );
  if (!parsed.success)
    throw new Error("Choose a PNG, JPEG, WebP, GIF, MP4, MOV or WebM file.");
  return parsed.data;
}
function base64(bytes: Uint8Array) {
  let text = "";
  for (let i = 0; i < bytes.length; i += 8192)
    text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
export async function uploadFileViaMcp(input: {
  workspaceId: string;
  file: File;
  uploadId: string | null;
  idempotencyKey: string;
  call: McpUploadCaller;
  signal: AbortSignal;
  onSession: (s: McpUploadSession) => void;
  onProgress: (
    stage: "checking" | "uploading" | "processing",
    bytes: number,
  ) => void;
}) {
  const { file, signal } = input,
    hashes: string[] = [];
  const check = () => {
    if (signal.aborted)
      throw new McpUploadClientError(
        "paused",
        "Upload paused. The saved chunks are kept; resume with the same file.",
      );
  };
  check();
  const contentType = uploadFileContentType(file);
  for (let offset = 0; offset < file.size; offset += MCP_UPLOAD_CHUNK_BYTES) {
    check();
    hashes.push(
      await bytesSha256(
        new Uint8Array(
          await file
            .slice(offset, offset + MCP_UPLOAD_CHUNK_BYTES)
            .arrayBuffer(),
        ),
      ),
    );
    input.onProgress(
      "checking",
      Math.min(offset + MCP_UPLOAD_CHUNK_BYTES, file.size),
    );
  }
  const fileFingerprint = await uploadFileFingerprint(
    file.size,
    MCP_UPLOAD_CHUNK_BYTES,
    hashes,
  );
  check();
  let session = mcpUploadSessionSchema.parse(
    await callUploadTool(
      input.call,
      input.uploadId ? "get_media_upload" : "start_media_upload",
      input.uploadId
        ? { workspaceId: input.workspaceId, uploadId: input.uploadId }
        : {
            workspaceId: input.workspaceId,
            idempotencyKey: input.idempotencyKey,
            fileName: file.name,
            contentType,
            sizeBytes: file.size,
            fileFingerprint,
            title: file.name,
            attribution: "Original file selected in the MCP upload panel.",
          },
    ),
  );
  if (
    session.fileFingerprint !== fileFingerprint ||
    session.sizeBytes !== file.size
  )
    throw new Error(
      "This upload belongs to a different file. Select the original file or cancel it before starting a new upload.",
    );
  input.onSession(session);
  if (["queued", "running", "succeeded"].includes(session.status))
    return session;
  if (session.status !== "awaiting_upload")
    throw new Error(
      "This upload is no longer active. Start a new upload for the selected file.",
    );
  const received = new Set(session.receivedIndices);
  let uploaded = session.receivedBytes;
  input.onProgress("uploading", uploaded);
  for (let index = 0; index < hashes.length; index++) {
    check();
    if (received.has(index)) continue;
    const bytes = new Uint8Array(
      await file
        .slice(
          index * MCP_UPLOAD_CHUNK_BYTES,
          (index + 1) * MCP_UPLOAD_CHUNK_BYTES,
        )
        .arrayBuffer(),
    );
    if ((await bytesSha256(bytes)) !== hashes[index])
      throw new Error(
        "The selected file changed while uploading. Start a new upload.",
      );
    await callUploadTool(input.call, "append_media_upload", {
      workspaceId: input.workspaceId,
      uploadId: session.uploadId,
      index,
      sha256: hashes[index],
      dataBase64: base64(bytes),
      idempotencyKey: mcpUploadKey(session.uploadId, index, hashes[index]),
    });
    uploaded += bytes.length;
    input.onProgress("uploading", uploaded);
    // Leave room within the connection's active-upload rate limit; no status polling.
    if (index < hashes.length - 1)
      await new Promise((resolve) => setTimeout(resolve, 250));
  }
  check();
  input.onProgress("processing", file.size);
  session = mcpUploadSessionSchema.parse(
    await callUploadTool(input.call, "complete_media_upload", {
      workspaceId: input.workspaceId,
      uploadId: session.uploadId,
      idempotencyKey: mcpUploadKey(session.uploadId, "complete"),
    }),
  );
  input.onSession(session);
  return session;
}
