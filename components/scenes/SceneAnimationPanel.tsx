import type { Character } from "@/db/schema";
import { SceneAnimationDialog } from "@/components/scenes/SceneAnimationDialog";
import { Badge } from "@/components/ui/badge";

export function SceneAnimationPanel({
  projectId,
  sceneId,
  sceneVersionId,
  canEdit,
  animationReadyCharacters,
  animatedCharacter,
}: {
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  canEdit: boolean;
  animationReadyCharacters: Character[];
  animatedCharacter: Character | null;
}) {
  const canOpenDialog =
    canEdit && (animationReadyCharacters.length > 0 || animatedCharacter);
  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Animated character</h3>
          <p className="text-xs text-muted-foreground">
            Drive this scene from a rigged pose character instead of the static
            scene image.
          </p>
        </div>
        {canOpenDialog ? (
          <SceneAnimationDialog
            animationReadyCharacters={animationReadyCharacters}
            currentCharacterId={animatedCharacter?.id ?? null}
            projectId={projectId}
            sceneId={sceneId}
            sceneVersionId={sceneVersionId}
          />
        ) : null}
      </div>
      {animatedCharacter ? (
        <Badge variant="secondary">{animatedCharacter.name}</Badge>
      ) : (
        <p className="text-sm text-muted-foreground">
          {canEdit && animationReadyCharacters.length === 0
            ? "No character has all four pose stills (idle/talk-open/talk-closed/blink) yet — generate them from the character's page to animate a scene."
            : "This scene renders as a static image."}
        </p>
      )}
    </section>
  );
}
