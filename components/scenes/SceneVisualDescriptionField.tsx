"use client";

import { useState } from "react";
import { CopyButton } from "@/components/ui/CopyButton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * What the scene should look like, with a way to take it elsewhere.
 *
 * Uncontrolled for the same reason as the narration field: the form reads its
 * values through `FormData` and preserves the draft across a failed preview.
 * The mirrored state exists only so the copy button offers what is on screen
 * rather than what was loaded.
 */
export function SceneVisualDescriptionField({
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
        <Label htmlFor={id}>Visual description</Label>
        <CopyButton label="visual description" value={value} />
      </div>
      <Textarea
        defaultValue={defaultValue}
        disabled={disabled}
        id={id}
        name="visualDescription"
        onChange={(event) => setValue(event.target.value)}
        required
      />
    </div>
  );
}
