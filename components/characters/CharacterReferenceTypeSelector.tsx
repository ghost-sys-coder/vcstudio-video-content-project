import type { CharacterReferenceType } from "@/db/schema";
import { Label } from "@/components/ui/label";

export const characterReferenceTypeLabels: Record<
  CharacterReferenceType,
  string
> = {
  master: "Master reference",
  front: "Front view",
  threeQuarter: "Three-quarter view",
  side: "Side view",
  fullBody: "Full-body view",
  expression: "Expression reference",
  outfit: "Outfit reference",
  pose: "Pose reference",
};

const characterReferenceTypes = [
  "master",
  "front",
  "threeQuarter",
  "side",
  "fullBody",
  "expression",
  "outfit",
  "pose",
] as const satisfies readonly CharacterReferenceType[];

export function CharacterReferenceTypeSelector({
  value,
  onChange,
  disabled,
}: {
  value: CharacterReferenceType;
  onChange: (value: CharacterReferenceType) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="character-reference-type">Reference type</Label>
      <select
        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
        disabled={disabled}
        id="character-reference-type"
        onChange={(event) => {
          const type = characterReferenceTypes.find(
            (item) => item === event.target.value,
          );
          if (type) onChange(type);
        }}
        value={value}
      >
        {Object.entries(characterReferenceTypeLabels).map(([type, label]) => (
          <option key={type} value={type}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
