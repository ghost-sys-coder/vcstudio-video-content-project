/**
 * Reads a local video file's duration in the browser.
 *
 * This exists because the web runtime has no ffprobe — there is no way to
 * measure a video server-side inside a request. The result is therefore a hint,
 * not a fact: it is range-checked on the server and every platform re-validates
 * duration itself at publish time.
 *
 * Resolves null rather than rejecting when the browser cannot decode the file;
 * an unmeasurable video is still a perfectly valid upload.
 */
export function readVideoDurationMilliseconds(
  file: File,
): Promise<number | null> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      resolve(value);
    };

    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const seconds = video.duration;
      finish(
        Number.isFinite(seconds) && seconds > 0
          ? Math.round(seconds * 1000)
          : null,
      );
    };
    video.onerror = () => finish(null);
    video.src = objectUrl;
  });
}
