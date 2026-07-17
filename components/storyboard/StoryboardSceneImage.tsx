import Image from "next/image";
import { ImageIcon, Loader2Icon } from "lucide-react";
import type { StoryboardSceneView } from "@/lib/scenes/storyboard-view";
import { isActiveImageGenerationStatus } from "@/lib/domain/bulk-scene-image";

export function StoryboardSceneImage({
  scene,
}: {
  scene: StoryboardSceneView;
}) {
  const imageUrl = scene.approvedImageUrl ?? scene.latestImageUrl;
  const active =
    scene.latestStatus !== null &&
    isActiveImageGenerationStatus(scene.latestStatus);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted ring-1 ring-inset ring-foreground/10">
      {imageUrl ? (
        <Image
          alt={`Scene ${scene.sceneNumber} image`}
          className="object-cover"
          fill
          sizes="(max-width: 768px) 100vw, 360px"
          src={imageUrl}
          unoptimized
        />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImageIcon aria-hidden className="size-7" />
        </div>
      )}
      {active ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 text-xs font-medium text-muted-foreground backdrop-blur-sm">
          <Loader2Icon aria-hidden className="size-5 animate-spin" />
          {scene.progressPercent > 0 ? `${scene.progressPercent}%` : "Working…"}
        </div>
      ) : null}
      {scene.approvedImageUrl ? (
        <span className="absolute left-2 top-2 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold text-white">
          Approved
        </span>
      ) : null}
    </div>
  );
}
