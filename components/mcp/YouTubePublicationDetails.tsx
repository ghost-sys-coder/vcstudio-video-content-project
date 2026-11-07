import type { PublicationPreview } from "@studio/contracts";

export function YouTubePublicationDetails({
  youtube,
  videoId,
}: {
  youtube: NonNullable<PublicationPreview["destinations"][number]["youtube"]>;
  videoId?: string;
}) {
  return (
    <div className="mt-3 min-w-0 space-y-3 rounded-xl border bg-muted/20 p-4 text-sm">
      {videoId && (
        <p>
          Apply the saved thumbnail to existing YouTube video{" "}
          <strong>{videoId}</strong>. The video will not be uploaded again.
        </p>
      )}
      <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Video title</dt>
          <dd className="break-words font-medium">{youtube.title}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Visibility</dt>
          <dd className="capitalize">{youtube.visibility}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Made for kids</dt>
          <dd>
            {youtube.madeForKids === null
              ? "Unanswered"
              : youtube.madeForKids
                ? "Yes"
                : "No"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            Realistic altered or synthetic content
          </dt>
          <dd>
            {youtube.containsSyntheticMedia === null
              ? "Unanswered"
              : youtube.containsSyntheticMedia
                ? "Yes"
                : "No"}
          </dd>
        </div>
      </dl>
      <div>
        <p className="text-muted-foreground">Exact YouTube description</p>
        <p className="whitespace-pre-wrap break-words">
          {youtube.description || "No description"}
        </p>
      </div>
      <p className="break-words">
        <span className="text-muted-foreground">Tags: </span>
        {youtube.tags.join(", ") || "None"}
      </p>
      <p className="break-words">
        <span className="text-muted-foreground">Thumbnail: </span>
        {youtube.thumbnail
          ? youtube.thumbnail.name || youtube.thumbnail.id
          : "Chosen by YouTube"}
      </p>
    </div>
  );
}
