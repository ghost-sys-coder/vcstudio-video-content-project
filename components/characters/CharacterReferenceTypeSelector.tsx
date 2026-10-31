import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
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
  poseIdle: "Animation pose: idle",
  poseTalkOpen: "Animation pose: talking (mouth open)",
  poseTalkClosed: "Animation pose: talking (mouth closed)",
  poseBlink: "Animation pose: blinking",
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
  "poseIdle",
  "poseTalkOpen",
  "poseTalkClosed",
  "poseBlink",
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
      <FormSelect
        disabled={disabled}
        id="character-reference-type"
        onValueChange={(selectedValue) => {
          const type = characterReferenceTypes.find(
            (item) => item === selectedValue,
          );
          if (type) onChange(type);
        }}
        value={value}
      >
        {Object.entries(characterReferenceTypeLabels).map(([type, label]) => (
          <SelectItem key={type} value={String(type)}>
            {label}
          </SelectItem>
        ))}
      </FormSelect>
    </div>
  );
}
