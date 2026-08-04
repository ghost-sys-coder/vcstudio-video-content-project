import { SkillCostBadge } from "@/components/marketing/SkillCostBadge";
import type { MarketingSkillCatalogueItem } from "@/lib/marketing/skills/skill-definition";
export function SkillPickerItem({
  skill,
  active,
  onSelect,
}: {
  skill: MarketingSkillCatalogueItem;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left outline-none ${active ? "bg-accent" : "hover:bg-accent/60"}`}
      id={`skill-option-${skill.key}`}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
      role="option"
      type="button"
    >
      <span>
        <span className="block text-sm font-medium">{skill.label}</span>
        <span className="block text-xs text-muted-foreground">
          {skill.description}
        </span>
      </span>
      <SkillCostBadge range={skill.estimatedCostRangeCents} />
    </button>
  );
}
