import type { MediaAssetView } from "@/lib/media/media-asset-view";
import { readVideoDurationMilliseconds } from "@/lib/media/read-video-duration.client";
import {
  MEDIA_ASSET_KIND_BY_CONTENT_TYPE,
  type MediaContentType,
} from "@/lib/schemas/media-asset";

export type MediaUploadProgress = {
  phase: "preparing" | "uploading" | "finalizing";
  uploadedBytes: number;
  totalBytes: number;
};

function isSupportedContentType(value: string): value is MediaContentType {
  return value in MEDIA_ASSET_KIND_BY_CONTENT_TYPE;
}

/** XHR exposes real upload progress while still streaming the File direct to R2. */
function uploadToStorage(input: {
  url: string;
  file: File;
  onProgress?: (progress: MediaUploadProgress) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    let uploadedBytes = 0;
    // Register before open/send for consistent browser upload-event support.
    request.upload.addEventListener("progress", (event) => {
      if (!Number.isFinite(event.loaded)) return;
      uploadedBytes = Math.min(
        input.file.size,
        Math.max(uploadedBytes, event.loaded),
      );
      input.onProgress?.({
        phase: "uploading",
        uploadedBytes,
        totalBytes: input.file.size,
      });
    });
    request.addEventListener("load", () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else
        reject(
          new Error(
            `The storage service rejected the upload (HTTP ${request.status}).`,
          ),
        );
    });
    request.addEventListener("error", () =>
      reject(
        new Error(
          "The storage service blocked the upload. Check your connection and verify that this site is allowed by the bucket CORS policy.",
        ),
      ),
    );
    request.addEventListener("abort", () =>
      reject(new Error("The upload was interrupted. Please try again.")),
    );
    request.open("PUT", input.url);
    request.setRequestHeader("content-type", input.file.type);
    request.send(input.file);
  });
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
  onProgress?: (progress: MediaUploadProgress) => void;
}): Promise<MediaAssetView> {
  if (!isSupportedContentType(input.file.type))
    throw new Error(
      "That file type is not supported. Use JPEG, PNG, WebP, GIF, MP4, MOV, or WebM.",
    );
  const contentType = input.file.type;
  const kind = MEDIA_ASSET_KIND_BY_CONTENT_TYPE[contentType];
  input.onProgress?.({
    phase: "preparing",
    uploadedBytes: 0,
    totalBytes: input.file.size,
  });
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

  input.onProgress?.({
    phase: "uploading",
    uploadedBytes: 0,
    totalBytes: input.file.size,
  });
  await uploadToStorage({
    url: upload.uploadUrl,
    file: input.file,
    onProgress: input.onProgress,
  });
  input.onProgress?.({
    phase: "finalizing",
    uploadedBytes: input.file.size,
    totalBytes: input.file.size,
  });

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
  if (!completed.asset)
    throw new Error(
      "The upload completed but its status could not be loaded. Check your media library.",
    );
  return completed.asset;
}
