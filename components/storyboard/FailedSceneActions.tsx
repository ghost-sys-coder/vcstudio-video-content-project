import { AlertTriangleIcon } from "lucide-react";
import { RegenerateSceneDialog } from "@/components/storyboard/RegenerateSceneDialog";
import type { SceneImageStylePresetView } from "@/lib/scenes/scene-image-view";
import type {
  BulkGenerateHandler,
  StoryboardConfigurationView,
  StoryboardSceneView,
} from "@/lib/scenes/storyboard-view";

export function FailedSceneActions({
  scene,
  stylePresets,
  configuration,
  availableBudgetCents,
  canGenerate,
  onGenerate,
}: {
  scene: StoryboardSceneView;
  stylePresets: SceneImageStylePresetView[];
  configuration: StoryboardConfigurationView;
  availableBudgetCents: number;
  canGenerate: boolean;
  onGenerate: BulkGenerateHandler;
}) {
  const failedImages = scene.images.filter(
    (image) => image.latestStatus === "failed",
  );
  return (
    <div className="space-y-2 rounded-lg bg-destructive/5 p-3 ring-1 ring-inset ring-destructive/20">
      {failedImages.map((image) => (
        <p
          className="flex items-start gap-2 text-xs text-destructive"
          key={image.size}
        >
          <AlertTriangleIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {image.safeErrorMessage ??
              `This scene's ${image.size} image generation failed. Try again.`}
          </span>
        </p>
      ))}
      {canGenerate ? (
        <RegenerateSceneDialog
          availableBudgetCents={availableBudgetCents}
          configuration={configuration}
          disabled={false}
          onGenerate={onGenerate}
          scene={scene}
          stylePresets={stylePresets}
        />
      ) : null}
    </div>
  );
}
