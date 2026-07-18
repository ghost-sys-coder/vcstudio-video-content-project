/**
 * Ensures the caption font is decoded before the preview is allowed to start.
 *
 * If captions render on the first frames before their web font finishes
 * loading, the text reflows and the first playback appears to stutter. Awaiting
 * font readiness up front (alongside the initial asset window) removes that
 * class of first-play jank. Any failure resolves quietly because captions fall
 * back to `sans-serif`, which must never block playback.
 */
export async function ensurePreviewFontsReady(
  fontFamily: string,
): Promise<void> {
  if (typeof document === "undefined") return;
  const fontSet = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fontSet) return;

  const family = fontFamily.trim();
  if (family.length > 0) {
    const specifiers = [`400 48px "${family}"`, `700 48px "${family}"`];
    await Promise.all(
      specifiers.map(async (specifier) => {
        try {
          await fontSet.load(specifier);
        } catch {
          // A system/unavailable family rejects; the caption falls back safely.
        }
      }),
    );
  }

  try {
    await fontSet.ready;
  } catch {
    // Never let font readiness block the preview from starting.
  }
}
