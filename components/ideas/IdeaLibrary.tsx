import { EmptyIdeasState } from "@/components/ideas/EmptyIdeasState";
import { IdeaNicheSection } from "@/components/ideas/IdeaNicheSection";
import type { IdeaNicheGroup } from "@/lib/ideas/ideas-view";

export function IdeaLibrary({
  groups,
  canEdit,
  onArchived,
}: {
  groups: IdeaNicheGroup[];
  canEdit: boolean;
  onArchived: (id: string) => void;
}) {
  if (groups.length === 0) return <EmptyIdeasState />;
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <IdeaNicheSection
          key={group.niche}
          canEdit={canEdit}
          group={group}
          onArchived={onArchived}
        />
      ))}
    </div>
  );
}
