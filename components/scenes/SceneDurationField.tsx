import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SceneDurationField({
  value,
  disabled,
  id,
}: {
  value: number;
  disabled: boolean;
  id: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Duration (milliseconds)</Label>
      <Input
        defaultValue={value}
        disabled={disabled}
        id={id}
        min={1000}
        name="estimatedDurationMilliseconds"
        step={100}
        type="number"
      />
    </div>
  );
}
