import { LayoutGridIcon } from "lucide-react";

export function StoryboardIntro({
  canGenerate,
  generationEnabled,
}: {
  canGenerate: boolean;
  generationEnabled: boolean;
}) {
  return (
    <section
      aria-labelledby="storyboard-intro-heading"
      className="flex gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
    >
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"
      >
        <LayoutGridIcon className="size-4.5" />
      </span>
      <div className="space-y-1">
        <h2 className="text-sm font-semibold" id="storyboard-intro-heading">
          Storyboard
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Every approved scene appears here as a card showing its current image,
          generation status, and cost.{" "}
          {canGenerate ? (
            <>
              Select scenes and generate their images in bulk — you&rsquo;ll
              confirm the scene count and estimated cost first, then watch batch
              progress live and approve, reject, or regenerate each result.
            </>
          ) : generationEnabled ? (
            <>
              You have view-only access, so you can review scene images and
              their status but cannot start or approve generations.
            </>
          ) : (
            <>
              Image generation is currently disabled by server configuration, so
              scenes are shown for review only.
            </>
          )}{" "}
          Use the filters to focus on scenes that are eligible, in progress,
          awaiting review, or failed.
        </p>
      </div>
    </section>
  );
}
