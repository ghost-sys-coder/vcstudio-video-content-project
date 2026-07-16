import type { Character, CharacterReferenceAsset } from "@/db/schema";
import { ArchiveCharacterDialog } from "@/components/characters/ArchiveCharacterDialog";
import { CharacterForm } from "@/components/characters/CharacterForm";
import { CharacterReferenceGallery } from "@/components/characters/CharacterReferenceGallery";
import { CharacterReferenceUploader } from "@/components/characters/CharacterReferenceUploader";
import { Badge } from "@/components/ui/badge";

export function CharacterDetails({
  character,
  references,
  canManage,
}: {
  character: Character;
  references: CharacterReferenceAsset[];
  canManage: boolean;
}) {
  const editable = canManage && character.status !== "archived";
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{character.name}</h1>
            <Badge variant="secondary">{character.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Workspace character identity and consistency profile.
          </p>
        </div>
        {editable ? (
          <ArchiveCharacterDialog
            characterId={character.id}
            name={character.name}
          />
        ) : null}
      </div>
      {!editable ? (
        <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          This character is available as a read-only identity profile.
        </p>
      ) : null}
      <CharacterForm character={character} readOnly={!editable} />
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Reference gallery</h2>
          <p className="text-sm text-muted-foreground">
            Uploaded identity views used to preserve visual consistency.
          </p>
        </div>
        {editable ? (
          <CharacterReferenceUploader
            characterId={character.id}
            workspaceId={character.workspaceId}
          />
        ) : null}
        <CharacterReferenceGallery
          canManage={editable}
          references={references}
        />
      </section>
    </div>
  );
}
