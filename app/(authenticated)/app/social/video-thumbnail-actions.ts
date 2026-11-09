"use server";

import {
  requestVideoThumbnail,
  checkVideoThumbnail,
} from "@/lib/media/video-thumbnail-service";

export async function requestVideoThumbnailAction(input: unknown) {
  return requestVideoThumbnail(input);
}

export async function checkVideoThumbnailAction(input: unknown) {
  return checkVideoThumbnail(input);
}
