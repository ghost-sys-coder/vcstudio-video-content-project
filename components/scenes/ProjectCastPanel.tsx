import type { Character, CharacterStatus } from "@/db/schema";
import { AddCastCharacterDialog } from "@/components/scenes/AddCastCharacterDialog";
import { ApplyCastToScenesButton } from "@/components/scenes/ApplyCastToScenesButton";
import { RemoveCastCharacterButton } from "@/components/scenes/RemoveCastCharacterButton";
import { Badge } from "@/components/ui/badge";

export type ProjectCastEntry = {
  characterId: string;
  name: string;
  status: CharacterStatus;
  matchedSceneCount: number;
};

export function ProjectCastPanel({
  projectId,
  canEdit,
  cast,
  availableCharacters,
  totalScenes,
}: {
  projectId: string;
  canEdit: boolean;
  cast: ProjectCastEntry[];
  availableCharacters: Character[];
  totalScenes: number;
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Project cast</h2>
          <p className="text-xs text-muted-foreground">
            Characters used in this project. Apply them to scenes to keep
            identities and reference images consistent throughout.
          </p>
        </div>
        {canEdit ? (
          <div className="flex items-center gap-2">
            <AddCastCharacterDialog
              availableCharacters={availableCharacters}
              projectId={projectId}
            />
            <ApplyCastToScenesButton
              disabled={cast.length === 0 || totalScenes === 0}
              projectId={projectId}
            />
          </div>
        ) : null}
      </div>
      {cast.length ? (
        <ul className="space-y-2">
          {cast.map((entry) => (
            <li
              className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3"
              key={entry.characterId}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{entry.name}</span>
                {entry.status === "archived" ? (
                  <Badge variant="outline">Archived</Badge>
                ) : null}
                <Badge variant="secondary">
                  Matched in {entry.matchedSceneCount}/{totalScenes} scene
                  {totalScenes === 1 ? "" : "s"}
                </Badge>
              </div>
              {canEdit ? (
                <RemoveCastCharacterButton
                  characterId={entry.characterId}
                  characterName={entry.name}
                  projectId={projectId}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No characters in the cast yet.
          {canEdit
            ? " Add characters, then apply them to scenes."
            : " An editor can add characters to keep this project consistent."}
        </p>
      )}
    </section>
  );
}
