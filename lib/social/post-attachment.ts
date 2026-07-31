import type { MediaAsset, MediaAssetKind, VideoRender } from "@/db/schema";

/**
 * One attachment on a post, flattened to the fields publishing actually needs.
 *
 * A post can attach either a library upload or a finished project render. Every
 * consumer downstream — the eligibility matrix, the publish worker, the composer
 * preview — cares about the same handful of properties, so they are normalised
 * once here instead of each caller branching on the source. `source` survives
 * only so the UI can say where a file came from.
 *
 * Pure and free of `server-only`: the repository builds these, the composer view
 * reads them.
 */
export type SocialPostAttachment = {
  /** The `social_post_media` row id. */
  linkId: string;
  position: number;
  source: "library" | "render";
  /** The media asset id or the video render id, per `source`. */
  sourceId: string;
  kind: MediaAssetKind;
  objectKey: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMilliseconds: number | null;
  title: string;
  altText: string;
  originalFileName: string;
  createdAt: Date;
  /**
   * The underlying file can no longer be sent — a library asset that was
   * removed, or a render whose output is missing. The attachment is still listed
   * (a published post must show what it sent) but publishing must refuse it.
   */
  unavailable: boolean;
};

/**
 * How the composer names an attachment when saving: which table it lives in and
 * its id there. Deliberately not a bare id — the same UUID space is shared, and
 * a save must not have to guess.
 */
export type SocialPostAttachmentRef = {
  source: "library" | "render";
  id: string;
};

export function toAttachmentRef(
  attachment: SocialPostAttachment,
): SocialPostAttachmentRef {
  return { source: attachment.source, id: attachment.sourceId };
}

/** A render's stored file name, derived rather than stored. */
function renderFileName(render: VideoRender): string {
  const extension = render.assetContentType?.includes("webm") ? "webm" : "mp4";
  return `render-${render.id}.${extension}`;
}

/**
 * Human label for a render attachment, e.g. `1080×1920 · 0:42`.
 *
 * Renders have no author-given title the way library uploads do, so the
 * dimensions and runtime — the two things that decide which platforms will
 * accept it — stand in.
 */
export function buildRenderAttachmentTitle(render: VideoRender): string {
  const milliseconds =
    render.outputDurationMilliseconds ?? render.durationMilliseconds;
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${render.width}×${render.height} · ${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function toLibraryAttachment(input: {
  linkId: string;
  position: number;
  asset: MediaAsset;
}): SocialPostAttachment {
  return {
    linkId: input.linkId,
    position: input.position,
    source: "library",
    sourceId: input.asset.id,
    kind: input.asset.kind,
    objectKey: input.asset.objectKey,
    contentType: input.asset.contentType,
    sizeBytes: input.asset.sizeBytes,
    width: input.asset.width,
    height: input.asset.height,
    durationMilliseconds: input.asset.durationMilliseconds,
    title:
      input.asset.title.trim() === ""
        ? input.asset.originalFileName
        : input.asset.title,
    altText: input.asset.altText,
    originalFileName: input.asset.originalFileName,
    createdAt: input.asset.createdAt,
    unavailable: input.asset.deletedAt !== null,
  };
}

export function toRenderAttachment(input: {
  linkId: string;
  position: number;
  render: VideoRender;
}): SocialPostAttachment {
  const usable =
    input.render.status === "succeeded" &&
    input.render.assetObjectKey !== null &&
    input.render.assetSizeBytes !== null;
  return {
    linkId: input.linkId,
    position: input.position,
    source: "render",
    sourceId: input.render.id,
    kind: "video",
    objectKey: input.render.assetObjectKey ?? "",
    // Renderer output is MP4 unless a preset said otherwise; the stored content
    // type wins when the upload recorded one.
    contentType: input.render.assetContentType ?? "video/mp4",
    sizeBytes: input.render.assetSizeBytes ?? 0,
    width: input.render.width,
    height: input.render.height,
    durationMilliseconds:
      input.render.outputDurationMilliseconds ??
      input.render.durationMilliseconds,
    title: buildRenderAttachmentTitle(input.render),
    // A render has no alt text to carry; captions are burned into the video.
    altText: "",
    originalFileName: renderFileName(input.render),
    createdAt: input.render.createdAt,
    unavailable: !usable,
  };
}
