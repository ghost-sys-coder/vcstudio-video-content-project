import type { Character } from "@/db/schema";
import { CharacterAssignmentDialog } from "@/components/scenes/CharacterAssignmentDialog";
import { Badge } from "@/components/ui/badge";

export function SceneCharacterList({
  assignedCharacters,
  availableCharacters,
  canEdit,
  projectId,
  sceneId,
  sceneVersionId,
}: {
  assignedCharacters: Character[];
  availableCharacters: Character[];
  canEdit: boolean;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
}) {
  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Assigned characters</h3>
          <p className="text-xs text-muted-foreground">
            Structured character identities linked to this scene version.
          </p>
        </div>
        {canEdit ? (
          <CharacterAssignmentDialog
            assignedCharacterIds={assignedCharacters.map(
              (character) => character.id,
            )}
            characters={availableCharacters}
            projectId={projectId}
            sceneId={sceneId}
            sceneVersionId={sceneVersionId}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {assignedCharacters.length ? (
          assignedCharacters.map((character) => (
            <Badge key={character.id} variant="secondary">
              {character.name}
              {character.status === "archived" ? " (archived)" : ""}
            </Badge>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No structured characters assigned.
          </p>
        )}
      </div>
    </section>
  );
}
