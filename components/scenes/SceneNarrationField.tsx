"use client";

import { useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * The scene's spoken words, with a way to take them elsewhere.
 *
 * The field stays uncontrolled, which is what the surrounding form relies on:
 * it reads values back through `FormData` and deliberately keeps the draft
 * across a failed preview. The copy button needs the text as it stands now
 * rather than as it loaded, so the current value is mirrored into state purely
 * for the button. React still does not own the field.
 */
export function SceneNarrationField({
  defaultValue,
  disabled,
  id,
}: {
  defaultValue: string;
  disabled: boolean;
  id: string;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>Narration</Label>
        <CopyButton label="narration" value={value} />
      </div>
      <Textarea
        defaultValue={defaultValue}
        disabled={disabled}
        id={id}
        name="narrationText"
        onChange={(event) => setValue(event.target.value)}
        required
      />
    </div>
  );
}
