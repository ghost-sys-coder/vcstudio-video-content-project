import type { Character } from "@/db/schema";
import { CharacterCard } from "@/components/characters/CharacterCard";

export function CharacterGrid({ characters }: { characters: Character[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {characters.map((character) => (
        <CharacterCard character={character} key={character.id} />
      ))}
    </div>
  );
}
