import "server-only";
import { withPublicDownload } from "@/lib/mcp/safe-download";
import { VideoProviderError } from "../video-provider";
import { MAX_VIDEO_BYTES } from "./provider-http";
/** Credentials stay on provider APIs. Public result downloads use DNS-pinned SSRF checks. */
export function downloadPublicVideo(uri: string) {
  return withPublicDownload(uri, async (response) => {
    if ((response.contentLength ?? 0) > MAX_VIDEO_BYTES)
      throw new VideoProviderError("response_too_large", false);
    const chunks: Uint8Array[] = [];
    let total = 0;
    for await (const chunk of response.body) {
      total += chunk.byteLength;
      if (total > MAX_VIDEO_BYTES)
        throw new VideoProviderError("response_too_large", false);
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, total);
  });
}
