import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SkillInputField as SkillInputFieldData } from "@/lib/marketing/skills/skill-definition";
export function SkillInputField({
  field,
  value,
  onChange,
}: {
  field: SkillInputFieldData;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`skill-${field.key}`}>{field.label}</Label>
      {field.type === "longtext" ? (
        <Textarea
          id={`skill-${field.key}`}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          value={value}
        />
      ) : field.options ? (
        <FormSelect
          id={`skill-${field.key}`}
          onValueChange={(selectedValue) => onChange(selectedValue)}
          value={value}
        >
          <SelectItem value="">Select…</SelectItem>
          {field.options.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </FormSelect>
      ) : (
        <Input
          id={`skill-${field.key}`}
          max={field.type === "number" ? field.maximum : undefined}
          min={field.type === "number" ? field.minimum : undefined}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          type={field.type === "number" ? "number" : "text"}
          value={value}
        />
      )}
    </div>
  );
}
