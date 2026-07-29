/* eslint-disable @next/next/no-img-element */
import {
  ANIMATION_POSE_LABELS,
  type AnimationPoseDiagnostic,
} from "@/lib/characters/animation-check-view";

/**
 * The four pose stills as plain images on a checkered swatch.
 *
 * Two jobs. It makes an uncut pose obvious on sight — the opaque plate covers
 * the checker squares — without waiting to interpret a percentage. And it is
 * the fastest way to tell a sprite problem from an asset problem: if these
 * thumbnails appear but the player below is empty, the images are fine and the
 * compositing is at fault; if they are blank too, the signed URLs are.
 *
 * Deliberately a plain `img` rather than `next/image`: these are short-lived
 * signed URLs on a private bucket, so there is nothing for the image optimizer
 * to cache and no configured remote pattern to match.
 */
export function AnimationPoseThumbnails({
  poses,
}: {
  poses: AnimationPoseDiagnostic[];
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {poses.map((pose) => (
        <li className="space-y-1" key={pose.pose}>
          <div
            className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border"
            style={{
              backgroundColor: "#c7d2fe",
              backgroundImage:
                "linear-gradient(45deg, #6366f1 25%, transparent 25%), linear-gradient(-45deg, #6366f1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #6366f1 75%), linear-gradient(-45deg, transparent 75%, #6366f1 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
            }}
          >
            {pose.previewUrl ? (
              <img
                alt={`${ANIMATION_POSE_LABELS[pose.pose]} pose`}
                className="size-full object-contain"
                src={pose.previewUrl}
              />
            ) : (
              <span className="px-2 text-center text-xs text-muted-foreground">
                Not generated
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {ANIMATION_POSE_LABELS[pose.pose]}
          </p>
        </li>
      ))}
    </ul>
  );
}
