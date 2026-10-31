import type { CharacterListItem } from "@/db/repositories/characters.repository";
import { CharacterGrid } from "@/components/characters/CharacterGrid";
import { CreateCharacterDialog } from "@/components/characters/CreateCharacterDialog";
import { EmptyCharactersState } from "@/components/characters/EmptyCharactersState";

export function CharacterLibrary({
  characters,
  canManage,
}: {
  characters: CharacterListItem[];
  canManage: boolean;
}) {
  return (
    <section className="app-page">
      <div className="app-page-header">
        <div className="app-heading">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Workspace
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Character library
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Build reusable identity and continuity references for every
            production.
            {characters.length > 0 ? (
              <span className="ml-1 text-foreground">
                {characters.length}{" "}
                {characters.length === 1 ? "character" : "characters"}.
              </span>
            ) : null}
          </p>
        </div>
        {canManage ? <CreateCharacterDialog /> : null}
      </div>
      {characters.length ? (
        <CharacterGrid characters={characters} />
      ) : (
        <EmptyCharactersState />
      )}
    </section>
  );
}
