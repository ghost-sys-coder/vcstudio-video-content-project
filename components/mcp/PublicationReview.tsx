import type { ReactNode } from "react";
import type { PublicationPreview } from "@studio/contracts";
import type { McpMediaPreview } from "@/lib/mcp/media-previews";
import { YouTubePublicationDetails } from "./YouTubePublicationDetails";
export function PublicationReview({
  preview,
  actions,
  mediaPreviews = [],
  autonomous = false,
}: {
  preview: PublicationPreview;
  actions?: ReactNode;
  mediaPreviews?: McpMediaPreview[];
  autonomous?: boolean;
}) {
  return (
    <section className="app-section min-w-0">
      <div className="app-heading">
        <h2 className="text-xl font-semibold">
          {autonomous
            ? "Prepared autonomous operation"
            : preview.action === "retry_thumbnail"
              ? "Review YouTube thumbnail retry"
              : preview.action === "cancel_schedule"
                ? "Review schedule cancellation"
                : preview.scheduledAt
                  ? "Review scheduled publication"
                  : "Review publication"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {autonomous ? (
            "This connection is authorized to execute this exact preview without a review click. The preparation is valid for ten minutes."
          ) : (
            <>
              {preview.action === "retry_thumbnail"
                ? "Approve applying the saved thumbnail to the existing YouTube video."
                : preview.action === "cancel_schedule"
                  ? "Approve removing this post from the calendar. Its content and media will remain."
                  : "Confirm the exact content and destination accounts."}{" "}
              This approval is valid for ten minutes.
            </>
          )}
        </p>
      </div>
      <div className="app-panel">
        <h3 className="mb-2 font-medium">Post text</h3>
        <p className="whitespace-pre-wrap break-words">
          {preview.text || "Media-only post"}
        </p>
      </div>
      <div className="app-panel">
        <h3 className="mb-2 font-medium">Media · {preview.media.length}</h3>
        {preview.media.length ? (
          <ul className="space-y-2">
            {preview.media.map((m) => (
              <li key={m.id} className="break-words text-sm">
                {m.name || m.id} · {m.kind} ·{" "}
                {Math.ceil(m.sizeBytes / 1024).toLocaleString()} KB
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Text-only post</p>
        )}
      </div>
      <div className="app-panel">
        <h3 className="mb-2 font-medium">Destination accounts</h3>
        <ul className="space-y-3">
          {preview.destinations.map((d) => (
            <li key={d.id}>
              <strong className="break-words">{d.name}</strong>
              <span className="ml-2 text-sm text-muted-foreground">
                {d.platform}
              </span>
              {d.platform === "tiktok" && (
                <p className="text-sm">
                  Send to TikTok inbox; finish posting in TikTok. Add the
                  caption and choose the cover frame inside TikTok before
                  posting. Cover selection through VCStudio is unavailable with
                  current permissions.
                </p>
              )}
              {d.youtube && (
                <YouTubePublicationDetails
                  youtube={d.youtube}
                  videoId={d.existingVideoId}
                />
              )}
            </li>
          ))}
        </ul>
      </div>
      {preview.scheduledAt && (
        <div className="app-panel">
          <h3 className="mb-2 font-medium">Schedule</h3>
          <p>
            {new Intl.DateTimeFormat("en-GB", {
              dateStyle: "full",
              timeStyle: "short",
              timeZone: preview.timezone,
            }).format(new Date(preview.scheduledAt))}{" "}
            · {preview.timezone}
          </p>
          <p className="text-sm text-muted-foreground">
            UTC: {preview.scheduledAt}
          </p>
        </div>
      )}
      {mediaPreviews.length > 0 && (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          {mediaPreviews.map((m) =>
            m.kind === "image" ? (
              // Signed originals intentionally bypass Next's image optimizer.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={m.id}
                src={m.url}
                alt={
                  preview.destinations.find(
                    (d) => d.youtube?.thumbnail?.id === m.id,
                  )?.youtube?.thumbnail?.name ||
                  preview.media.find((p) => p.id === m.id)?.name ||
                  "Post image"
                }
                loading="lazy"
                className="max-h-80 w-full rounded-xl border bg-muted object-contain"
              />
            ) : (
              <video
                key={m.id}
                src={m.url}
                controls
                preload="none"
                aria-label={
                  preview.media.find((p) => p.id === m.id)?.name || "Post video"
                }
                className="max-h-80 w-full rounded-xl border bg-muted"
              />
            ),
          )}
        </div>
      )}
      {actions}
    </section>
  );
}
