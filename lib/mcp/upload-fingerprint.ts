/** Hashes fixed-size chunk digests, not the full file in memory. */
export async function uploadFileFingerprint(
  sizeBytes: number,
  chunkBytes: number,
  hashes: readonly string[],
) {
  return bytesSha256(
    new TextEncoder().encode(
      `vcstudio-mcp-upload-v1:${sizeBytes}:${chunkBytes}:${hashes.join(":")}`,
    ),
  );
}
export async function bytesSha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}
