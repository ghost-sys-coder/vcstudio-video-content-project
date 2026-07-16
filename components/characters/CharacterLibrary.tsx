import type { Character } from "@/db/schema";
import { CharacterGrid } from "@/components/characters/CharacterGrid";
import { CreateCharacterDialog } from "@/components/characters/CreateCharacterDialog";
import { EmptyCharactersState } from "@/components/characters/EmptyCharactersState";

export function CharacterLibrary({
  characters,
  canManage,
}: {
  characters: Character[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Character library</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Build reusable identity and continuity references for every
            production.
          </p>
        </div>
        {canManage ? <CreateCharacterDialog /> : null}
      </div>
      {characters.length ? (
        <CharacterGrid characters={characters} />
      ) : (
        <EmptyCharactersState />
      )}
    </div>
  );
}
