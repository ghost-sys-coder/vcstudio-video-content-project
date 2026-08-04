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
        <select
          className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
          id={`skill-${field.key}`}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          <option value="">Select…</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <Input
          id={`skill-${field.key}`}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          value={value}
        />
      )}
    </div>
  );
}
