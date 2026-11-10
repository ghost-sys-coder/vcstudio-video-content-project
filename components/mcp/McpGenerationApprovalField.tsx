import type { McpGenerationApprovalMode } from "@studio/contracts";
import { FormSelect } from "@/components/ui/FormSelect";
import { Label } from "@/components/ui/label";
import { SelectItem } from "@/components/ui/select";

export function McpGenerationApprovalField({
  id,
  value,
  onChange,
  owner,
  disabled,
}: {
  id: string;
  value: McpGenerationApprovalMode;
  onChange: (mode: McpGenerationApprovalMode) => void;
  owner: boolean;
  disabled: boolean;
}) {
  return (
    <div className="app-section rounded-xl border bg-muted/25 p-4">
      <div className="app-heading">
        <Label htmlFor={id}>Generation approval</Label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Allow a trusted assistant to generate images and narration without a
          review click. Each request still needs an exact estimate and a maximum
          cost, and must fit your workspace and project budgets.
        </p>
      </div>
      <FormSelect
        id={id}
        name="generationApprovalMode"
        value={value}
        onValueChange={(next) => {
          if (next === "manual" || next === "autonomous") onChange(next);
        }}
        disabled={disabled}
      >
        <SelectItem value="manual">Require my approval</SelectItem>
        <SelectItem value="autonomous" disabled={!owner}>
          Autonomous generation
        </SelectItem>
      </FormSelect>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Only an owner can enable this. Generate media permission and OAuth
        consent are required. With Review and autonomous Publish permissions,
        the assistant can also review generated scene media and publish eligible
        content end to end. Saving starts no work.
      </p>
    </div>
  );
}
