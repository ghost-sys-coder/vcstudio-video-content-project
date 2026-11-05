import "server-only";
import { VideoProviderError } from "../video-provider";

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export async function boundedResponseBytes(
  response: Response,
  maximum: number,
): Promise<Buffer> {
  const size = Number(response.headers.get("content-length"));
  if (Number.isFinite(size) && size > maximum)
    throw new VideoProviderError("response_too_large", false);
  if (!response.body) throw new VideoProviderError("empty_response", false);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      total += item.value.byteLength;
      if (total > maximum)
        throw new VideoProviderError("response_too_large", false);
      chunks.push(item.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  return Buffer.concat(chunks, total);
}
export async function providerJson(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(180_000),
    });
  } catch {
    throw new VideoProviderError("provider_connection_uncertain", false);
  }
  const requestId = response.headers.get("x-request-id")?.slice(0, 200) ?? null;
  if (!response.ok) {
    await response.body?.cancel();
    throw new VideoProviderError(
      `provider_http_${response.status}`,
      [401, 403, 404].includes(response.status),
      requestId,
    );
  }
  const bytes = await boundedResponseBytes(
    response,
    Math.ceil((MAX_VIDEO_BYTES * 4) / 3) + 1024 * 1024,
  );
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new VideoProviderError("provider_invalid_response", false, requestId);
  }
}
