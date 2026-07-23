import Image from "next/image";
import { ImageIcon, Loader2Icon } from "lucide-react";
import type { StoryboardSceneImageView } from "@/lib/scenes/storyboard-view";
import { isActiveImageGenerationStatus } from "@/lib/domain/bulk-scene-image";
import { getSceneImageSizeLabel } from "@/lib/scenes/scene-image-size-options";

export function StoryboardSceneImageThumbnail({
  sceneNumber,
  image,
}: {
  sceneNumber: number;
  image: StoryboardSceneImageView;
}) {
  const imageUrl = image.approvedImageUrl ?? image.latestImageUrl;
  const active =
    image.latestStatus !== null &&
    isActiveImageGenerationStatus(image.latestStatus);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted ring-1 ring-inset ring-foreground/10">
      {imageUrl ? (
        <Image
          alt={`Scene ${sceneNumber} ${getSceneImageSizeLabel(image.size)} image`}
          className="object-cover"
          fill
          sizes="(max-width: 768px) 100vw, 240px"
          src={imageUrl}
          unoptimized
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImageIcon aria-hidden className="size-6" />
        </div>
      )}
      {active ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/70 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
          <Loader2Icon aria-hidden className="size-4 animate-spin" />
          {image.progressPercent > 0 ? `${image.progressPercent}%` : "Working…"}
        </div>
      ) : null}
      <span className="absolute bottom-1 left-1 rounded-full bg-background/80 px-1.5 py-0.5 text-[9px] font-semibold text-foreground ring-1 ring-foreground/10">
        {getSceneImageSizeLabel(image.size)}
      </span>
      {image.approvedImageUrl ? (
        <span className="absolute top-1 left-1 rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
          Approved
        </span>
      ) : null}
    </div>
  );
}
