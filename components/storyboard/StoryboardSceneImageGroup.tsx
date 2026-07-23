import { ImageIcon } from "lucide-react";
import type { StoryboardSceneView } from "@/lib/scenes/storyboard-view";
import { StoryboardSceneImageThumbnail } from "@/components/storyboard/StoryboardSceneImageThumbnail";

/** One thumbnail per size the scene has a generation for — a scene can now have several. */
export function StoryboardSceneImageGroup({
  scene,
}: {
  scene: StoryboardSceneView;
}) {
  if (scene.images.length === 0)
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-inset ring-foreground/10">
        <ImageIcon aria-hidden className="size-7" />
      </div>
    );

  return (
    <div
      className={
        scene.images.length > 1
          ? "grid grid-cols-2 gap-1.5"
          : "grid grid-cols-1"
      }
    >
      {scene.images.map((image) => (
        <StoryboardSceneImageThumbnail
          image={image}
          key={image.size}
          sceneNumber={scene.sceneNumber}
        />
      ))}
    </div>
  );
}
