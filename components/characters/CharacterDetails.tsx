import type { Character, CharacterReferenceAsset } from "@/db/schema";
import type { CharacterPortraitView } from "@/lib/characters/character-reference-generation-view";
import { ArchiveCharacterDialog } from "@/components/characters/ArchiveCharacterDialog";
import { CharacterForm } from "@/components/characters/CharacterForm";
import { CharacterPortraitGenerationList } from "@/components/characters/CharacterPortraitGenerationList";
import { CharacterReferenceGallery } from "@/components/characters/CharacterReferenceGallery";
import { CharacterReferenceUploader } from "@/components/characters/CharacterReferenceUploader";
import { CharacterStatusBadge } from "@/components/characters/CharacterStatusBadge";
import { GenerateCharacterPortraitDialog } from "@/components/characters/GenerateCharacterPortraitDialog";

export function CharacterDetails({
  character,
  references,
  canManage,
  portrait,
}: {
  character: Character;
  references: CharacterReferenceAsset[];
  canManage: boolean;
  portrait: CharacterPortraitView | null;
}) {
  const editable = canManage && character.status !== "archived";
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{character.name}</h1>
            <CharacterStatusBadge status={character.status} />
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
      {editable && portrait ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Generated portraits</h2>
              <p className="text-sm text-muted-foreground">
                Generate canonical reference images from this character&apos;s
                identity. They join the gallery above and are used automatically
                in scenes.
              </p>
            </div>
            {portrait.enabled ? (
              <GenerateCharacterPortraitDialog
                characterId={character.id}
                model={portrait.model}
                views={portrait.views}
              />
            ) : null}
          </div>
          {portrait.enabled ? (
            <CharacterPortraitGenerationList rows={portrait.recent} />
          ) : (
            <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              Portrait generation is disabled by server configuration.
            </p>
          )}
        </section>
      ) : null}
    </div>
  );
}
