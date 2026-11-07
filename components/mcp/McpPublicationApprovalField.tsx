import type { McpPublicationApprovalMode } from "@studio/contracts";
import { FormSelect } from "@/components/ui/FormSelect";
import { Label } from "@/components/ui/label";
import { SelectItem } from "@/components/ui/select";

export function McpPublicationApprovalField({
  id,
  value,
  onChange,
  owner,
  disabled,
}: {
  id: string;
  value: McpPublicationApprovalMode;
  onChange: (value: McpPublicationApprovalMode) => void;
  owner: boolean;
  disabled: boolean;
}) {
  return (
    <div className="app-section rounded-xl border bg-muted/25 p-4">
      <div className="app-heading">
        <Label htmlFor={id}>Publishing approval</Label>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Manual approval is the default. Autonomous publishing lets this
          connection publish, schedule, cancel schedules and retry thumbnails in
          this workspace without a review click. Internal content approvals stay
          unchanged.
        </p>
      </div>
      <FormSelect
        id={id}
        name="publicationApprovalMode"
        value={value}
        onValueChange={(next) => {
          if (next === "manual" || next === "autonomous") onChange(next);
        }}
        disabled={disabled}
      >
        <SelectItem value="manual">Require my approval</SelectItem>
        <SelectItem value="autonomous" disabled={!owner}>
          Autonomous publishing
        </SelectItem>
      </FormSelect>
      <p className="text-xs text-muted-foreground">
        Only a workspace owner can enable autonomy. Publish permission and OAuth
        consent are also required. Saving this setting starts no publication.
      </p>
    </div>
  );
}
