import type { Character, ProjectVideoKind } from "@/db/schema";
import { CharacterAssignmentDialog } from "@/components/scenes/CharacterAssignmentDialog";
import { SceneCharacterStagingRow } from "@/components/scenes/SceneCharacterStagingRow";
import { Badge } from "@/components/ui/badge";
import type { SceneCharacterStaging } from "@/lib/scenes/scene-character-staging";

export function SceneCharacterList({
  assignedCharacters,
  characterStaging,
  availableCharacters,
  canEdit,
  projectId,
  sceneId,
  sceneVersionId,
  videoKind,
}: {
  assignedCharacters: Character[];
  characterStaging: SceneCharacterStaging[];
  availableCharacters: Character[];
  canEdit: boolean;
  projectId: string;
  sceneId: string;
  sceneVersionId: string;
  videoKind: ProjectVideoKind;
}) {
  const isAnimated = videoKind === "animatedCharacter";
  const stagingByCharacterId = new Map(
    characterStaging.map((entry) => [entry.characterId, entry]),
  );
  const hasSpeaker = characterStaging.some((entry) => entry.isSpeaker);

  return (
    <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Assigned characters</h3>
          <p className="text-xs text-muted-foreground">
            {isAnimated
              ? "These characters are drawn over this scene's background. Pick who speaks the narration."
              : "Structured character identities linked to this scene version."}
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

      {assignedCharacters.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No structured characters assigned.
        </p>
      ) : isAnimated ? (
        <div className="space-y-2">
          {assignedCharacters.map((character) => {
            const staging = stagingByCharacterId.get(character.id);
            return (
              <SceneCharacterStagingRow
                canEdit={canEdit}
                character={character}
                isSpeaker={staging?.isSpeaker ?? false}
                key={character.id}
                projectId={projectId}
                sceneId={sceneId}
                sceneVersionId={sceneVersionId}
                stageSlot={staging?.stageSlot ?? "center"}
              />
            );
          })}
          {hasSpeaker ? null : (
            // Without a speaker nothing lip-syncs, so the scene silently
            // renders every character idle — worth flagging before the render.
            <p className="text-xs text-amber-600 dark:text-amber-500">
              No character is marked as speaking, so nobody will lip-sync to
              this scene&apos;s narration.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {assignedCharacters.map((character) => (
            <Badge key={character.id} variant="secondary">
              {character.name}
              {character.status === "archived" ? " (archived)" : ""}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}
