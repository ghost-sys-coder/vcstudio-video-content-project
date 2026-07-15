import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SceneCharacterSelector({
  characters,
  props,
  disabled,
  idPrefix,
}: {
  characters: string[];
  props: string[];
  disabled: boolean;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-characterNames`}>
          Characters (comma separated)
        </Label>
        <Input
          defaultValue={characters.join(", ")}
          disabled={disabled}
          id={`${idPrefix}-characterNames`}
          name="characterNames"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-propNames`}>Props (comma separated)</Label>
        <Input
          defaultValue={props.join(", ")}
          disabled={disabled}
          id={`${idPrefix}-propNames`}
          name="propNames"
        />
      </div>
    </div>
  );
}
