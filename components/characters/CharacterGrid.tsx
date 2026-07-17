import type { CharacterListItem } from "@/db/repositories/characters.repository";
import { CharacterCard } from "@/components/characters/CharacterCard";

export function CharacterGrid({
  characters,
}: {
  characters: CharacterListItem[];
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {characters.map((character) => (
        <CharacterCard character={character} key={character.id} />
      ))}
    </div>
  );
}
