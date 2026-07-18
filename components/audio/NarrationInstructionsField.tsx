import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NarrationInstructionsField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Delivery instructions</Label>
      <Textarea
        disabled={disabled}
        id={id}
        maxLength={2000}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Describe the tone and pacing, e.g. warm and steady, like a documentary narrator."
        rows={3}
        value={value}
      />
      <p className="text-xs text-muted-foreground">
        Guides how the voice performs the narration. Supported on instruction-
        aware models such as gpt-4o-mini-tts.
      </p>
    </div>
  );
}
