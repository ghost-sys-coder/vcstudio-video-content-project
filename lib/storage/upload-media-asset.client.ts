import type { MediaAssetView } from "@/lib/media/media-asset-view";
import { readVideoDurationMilliseconds } from "@/lib/media/read-video-duration.client";
import {
  MEDIA_ASSET_KIND_BY_CONTENT_TYPE,
  type MediaContentType,
} from "@/lib/schemas/media-asset";

function isSupportedContentType(value: string): value is MediaContentType {
  return value in MEDIA_ASSET_KIND_BY_CONTENT_TYPE;
}

/**
 * Uploads one file into the workspace media library.
 *
 * Three steps, matching the pattern already used for scene images and workspace
 * logos: authorize (server reserves a row and signs a PUT), upload direct to R2,
 * then confirm so the server can re-measure what actually landed. The file never
 * passes through the application server.
 */
export async function uploadMediaAsset(input: {
  workspaceId: string;
  file: File;
}): Promise<MediaAssetView | null> {
  if (!isSupportedContentType(input.file.type))
    throw new Error(
      "That file type is not supported. Use JPEG, PNG, WebP, GIF, MP4, MOV, or WebM.",
    );
  const contentType = input.file.type;
  const kind = MEDIA_ASSET_KIND_BY_CONTENT_TYPE[contentType];
  const durationMilliseconds =
    kind === "video" ? await readVideoDurationMilliseconds(input.file) : null;

  const base = `/api/workspaces/${input.workspaceId}/media`;
  const authorization = await fetch(`${base}/upload`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contentType,
      fileName: input.file.name,
      sizeBytes: input.file.size,
      durationMilliseconds,
    }),
  });
  if (!authorization.ok)
    throw new Error(
      (await authorization.json()).error ?? "Upload authorization failed.",
    );
  const upload = (await authorization.json()) as {
    mediaAssetId: string;
    objectKey: string;
    uploadUrl: string;
  };

  let uploaded: Response;
  try {
    uploaded = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: { "content-type": contentType },
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
      mediaAssetId: upload.mediaAssetId,
      objectKey: upload.objectKey,
      contentType,
      sizeBytes: input.file.size,
      durationMilliseconds,
    }),
  });
  if (!completion.ok)
    throw new Error(
      (await completion.json()).error ?? "Upload finalization failed.",
    );
  const completed = (await completion.json()) as {
    asset?: MediaAssetView;
    inspectionPending?: boolean;
  };
  return completed.inspectionPending ? null : (completed.asset ?? null);
}
