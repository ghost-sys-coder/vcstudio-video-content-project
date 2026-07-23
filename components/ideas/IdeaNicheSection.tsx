import { SavedIdeaCard } from "@/components/ideas/SavedIdeaCard";
import type { IdeaNicheGroup } from "@/lib/ideas/ideas-view";

export function IdeaNicheSection({
  group,
  canEdit,
  onArchived,
}: {
  group: IdeaNicheGroup;
  canEdit: boolean;
  onArchived: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h3 className="text-sm font-semibold capitalize">{group.niche}</h3>
        <span className="text-xs text-muted-foreground">
          {group.ideas.length} {group.ideas.length === 1 ? "idea" : "ideas"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {group.ideas.map((idea) => (
          <SavedIdeaCard
            key={idea.id}
            canEdit={canEdit}
            idea={idea}
            onArchived={onArchived}
          />
        ))}
      </div>
    </section>
  );
}
