import { createHash } from "node:crypto";

export type FingerprintInput = {
  promptVersion: string;
  profile: Record<string, unknown>;
  audiences: { id: string; updatedAt: string }[];
  offers: { id: string; updatedAt: string }[];
  /** Document checksums, not ids: edited text must change the fingerprint. */
  documents: { id: string; checksum: string; priority: number }[];
  maxTokens: number;
};

/**
 * Stable JSON: object keys sorted at every depth.
 *
 * `JSON.stringify` preserves insertion order, so two loaders that build the
 * same profile object with their keys in a different order would otherwise
 * produce different fingerprints for identical data — and mint a new snapshot
 * on every request.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(",")}}`;
}

/**
 * Fingerprints everything that contributes to the compiled context block.
 *
 * The properties that matter, and why each is deliberate:
 *
 * - **Collections are sorted by id** before hashing, so reordering rows in the
 *   database cannot look like a content change.
 * - **Documents contribute their checksum**, not their id or `updatedAt`. That
 *   is what makes re-uploading identical text a no-op while genuinely edited
 *   text mints a new snapshot — and it means toggling an unrelated document's
 *   title does not.
 * - **`promptVersion` and `maxTokens` are included**, because both change the
 *   rendered text. A prompt revision or a raised budget must produce a new
 *   snapshot, or the stored text would no longer match what the compiler now
 *   produces.
 */
export function createBrandContextFingerprint(input: FingerprintInput): string {
  const canonical = {
    promptVersion: input.promptVersion,
    maxTokens: input.maxTokens,
    profile: input.profile,
    audiences: [...input.audiences].sort((a, b) => a.id.localeCompare(b.id)),
    offers: [...input.offers].sort((a, b) => a.id.localeCompare(b.id)),
    documents: [...input.documents].sort((a, b) => a.id.localeCompare(b.id)),
  };
  return createHash("sha256").update(stableStringify(canonical)).digest("hex");
}
