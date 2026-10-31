import "server-only";

import { z } from "zod";
import type { SocialPostMediaItem } from "@/lib/publishing/social-post-provider";
import { PublishProviderError } from "@/lib/publishing/video-publish-provider";

const PART_BYTES = 4 * 1024 * 1024;
const initializeSchema = z.object({
  value: z.object({
    video: z.string().regex(/^urn:li:video:[A-Za-z0-9_-]+$/),
    uploadToken: z.string(),
    uploadInstructions: z
      .array(
        z.object({
          firstByte: z.number().int().nonnegative(),
          lastByte: z.number().int().nonnegative(),
          uploadUrl: z.url(),
        }),
      )
      .min(1)
      .max(1280),
  }),
});
const statusSchema = z.object({
  status: z.enum([
    "AVAILABLE",
    "PROCESSING",
    "WAITING_UPLOAD",
    "PROCESSING_FAILED",
  ]),
});

function fail(message: string, retriable = false, asset = false): never {
  throw new PublishProviderError({
    category: asset
      ? "asset_unavailable"
      : retriable
        ? "provider_server_error"
        : "video_rejected",
    safeMessage: message,
    retriable,
    mayHavePublished: false,
  });
}

function failResponse(response: Response, message: string): never {
  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 426
  ) {
    throw new PublishProviderError({
      category:
        response.status === 401
          ? "authorization_expired"
          : response.status === 403
            ? "insufficient_permissions"
            : "provider_version_retired",
      safeMessage:
        response.status === 401
          ? "The LinkedIn authorization expired. Reconnect the destination."
          : response.status === 403
            ? "LinkedIn refused the video operation. Check the app permissions and Page role."
            : "LinkedIn no longer accepts the configured API version. Ask an administrator to update it.",
      retriable: false,
      mayHavePublished: false,
    });
  }
  fail(message, response.status === 429 || response.status >= 500);
}

async function readPart(
  response: Response,
  expected: number,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!response.body)
    fail("The video file could not be read from storage.", false, true);
  const reader = response.body.getReader();
  const result = new Uint8Array(expected);
  let offset = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (offset + chunk.value.byteLength > expected) {
        await reader.cancel();
        fail("Storage returned an unexpected video byte range.", false, true);
      }
      result.set(chunk.value, offset);
      offset += chunk.value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }
  if (offset !== expected)
    fail("The video file was incomplete in storage.", false, true);
  return result;
}

/** Upload bounded R2 ranges, finalize in order, then wait for a usable video. */
export async function uploadLinkedInVideo(input: {
  accessToken: string;
  owner: string;
  item: SocialPostMediaItem;
  apiVersion: string;
  waitForProcessing?: (milliseconds: number) => Promise<void>;
}): Promise<string> {
  const headers = {
    Authorization: `Bearer ${input.accessToken}`,
    "LinkedIn-Version": input.apiVersion,
    "X-Restli-Protocol-Version": "2.0.0",
  };
  if (
    !Number.isSafeInteger(input.item.sizeBytes) ||
    input.item.sizeBytes <= 0 ||
    input.item.sizeBytes > 5 * 1024 ** 3
  )
    fail("The LinkedIn video size is invalid.");
  const initialize = await fetch(
    "https://api.linkedin.com/rest/videos?action=initializeUpload",
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: input.owner,
          fileSizeBytes: input.item.sizeBytes,
          uploadCaptions: false,
          uploadThumbnail: false,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  const parsed = initializeSchema.safeParse(
    await initialize.json().catch(() => ({})),
  );
  if (!initialize.ok || !parsed.success)
    failResponse(initialize, "LinkedIn could not initialize the video upload.");
  const { video, uploadToken, uploadInstructions } = parsed.data.value;
  let nextByte = 0;
  for (const part of uploadInstructions) {
    const url = new URL(part.uploadUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443") ||
      !(
        url.hostname.endsWith(".linkedin.com") ||
        url.hostname.endsWith(".licdn.com")
      )
    )
      fail("LinkedIn returned an invalid video upload destination.");
    if (
      part.firstByte !== nextByte ||
      part.lastByte < part.firstByte ||
      part.lastByte - part.firstByte + 1 > PART_BYTES ||
      part.lastByte >= input.item.sizeBytes
    )
      fail("LinkedIn returned invalid video upload ranges.");
    nextByte = part.lastByte + 1;
  }
  if (nextByte !== input.item.sizeBytes)
    fail("LinkedIn returned incomplete video upload ranges.");
  const uploadedPartIds: string[] = [];
  for (const part of uploadInstructions) {
    const source = await fetch(input.item.sourceUrl, {
      headers: { Range: `bytes=${part.firstByte}-${part.lastByte}` },
      signal: AbortSignal.timeout(60_000),
    });
    const isWholeSmallFile =
      part.firstByte === 0 && part.lastByte === input.item.sizeBytes - 1;
    if (
      !source.ok ||
      (source.status !== 206 && !(source.status === 200 && isWholeSmallFile)) ||
      (source.status === 206 &&
        source.headers.get("content-range") !==
          `bytes ${part.firstByte}-${part.lastByte}/${input.item.sizeBytes}`)
    ) {
      await source.body?.cancel();
      fail(
        "Storage could not supply the required video byte range.",
        false,
        true,
      );
    }
    const bytes = await readPart(source, part.lastByte - part.firstByte + 1);
    const uploaded = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: headers.Authorization,
        "content-type": "application/octet-stream",
      },
      body: bytes,
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
    if (!uploaded.ok)
      failResponse(uploaded, "LinkedIn could not receive the video upload.");
    const partId = uploaded.headers.get("etag")?.replace(/^"|"$/g, "");
    if (!partId) fail("LinkedIn did not confirm a video upload part.");
    uploadedPartIds.push(partId);
  }
  const finalized = await fetch(
    "https://api.linkedin.com/rest/videos?action=finalizeUpload",
    {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        finalizeUploadRequest: { video, uploadToken, uploadedPartIds },
      }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!finalized.ok)
    failResponse(finalized, "LinkedIn could not finalize the video upload.");
  for (let attempt = 0; attempt < 24; attempt += 1) {
    if (attempt > 0) await input.waitForProcessing?.(5000);
    const response = await fetch(
      `https://api.linkedin.com/rest/videos/${encodeURIComponent(video)}`,
      { headers, signal: AbortSignal.timeout(30_000), cache: "no-store" },
    );
    const status = statusSchema.safeParse(
      await response.json().catch(() => ({})),
    );
    if (!response.ok || !status.success)
      failResponse(response, "LinkedIn video processing could not be checked.");
    if (status.data.status === "AVAILABLE") return video;
    if (status.data.status === "PROCESSING_FAILED")
      fail(
        "LinkedIn could not process the video. Check its format and upload it again.",
      );
  }
  fail("LinkedIn is still processing the video. Try again later.", true);
}
