import { FormSelect } from "@/components/ui/FormSelect";
import { Label } from "@/components/ui/label";
import { SelectItem } from "@/components/ui/select";

/** One stage's choice: let the run accept gate-passing output, or stop for you. */
export function ProductionRunStageModeField({
  defaultValue,
  description,
  label,
  name,
}: {
  defaultValue: "auto" | "hold";
  description: string;
  label: string;
  name: string;
}) {
  const id = `production-run-${name}`;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <FormSelect defaultValue={defaultValue} id={id} name={name}>
        <SelectItem value="auto">Accept when the check passes</SelectItem>
        <SelectItem value="hold">Stop and wait for me</SelectItem>
      </FormSelect>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
