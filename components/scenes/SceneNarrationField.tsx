import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function SceneNarrationField({
  defaultValue,
  disabled,
  id,
}: {
  defaultValue: string;
  disabled: boolean;
  id: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Narration</Label>
      <Textarea
        defaultValue={defaultValue}
        disabled={disabled}
        id={id}
        name="narrationText"
        required
      />
    </div>
  );
}
