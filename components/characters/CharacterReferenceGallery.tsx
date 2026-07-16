import type { CharacterReferenceAsset } from "@/db/schema";
import { CharacterReferenceCard } from "@/components/characters/CharacterReferenceCard";

export function CharacterReferenceGallery({
  references,
  canManage,
}: {
  references: CharacterReferenceAsset[];
  canManage: boolean;
}) {
  return references.length ? (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {references.map((reference) => (
        <CharacterReferenceCard
          canManage={canManage}
          key={reference.id}
          reference={reference}
        />
      ))}
    </div>
  ) : (
    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      No reference images uploaded yet.
    </div>
  );
}
