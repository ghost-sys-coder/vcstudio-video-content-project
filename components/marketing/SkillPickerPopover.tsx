import { SkillPickerEmptyState } from "@/components/marketing/SkillPickerEmptyState";
import { SkillPickerItem } from "@/components/marketing/SkillPickerItem";
import type { MarketingSkillCatalogueItem } from "@/lib/marketing/skills/skill-definition";
export function SkillPickerPopover({
  skills,
  activeIndex,
  onSelect,
}: {
  skills: MarketingSkillCatalogueItem[];
  activeIndex: number;
  onSelect: (skill: MarketingSkillCatalogueItem) => void;
}) {
  return (
    <div
      className="absolute right-2 bottom-full left-2 z-20 mb-2 max-h-80 overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg"
      role="listbox"
    >
      {skills.length === 0 ? (
        <SkillPickerEmptyState />
      ) : (
        skills.map((skill, index) => (
          <SkillPickerItem
            active={index === activeIndex}
            key={skill.key}
            onSelect={() => onSelect(skill)}
            skill={skill}
          />
        ))
      )}
    </div>
  );
}
