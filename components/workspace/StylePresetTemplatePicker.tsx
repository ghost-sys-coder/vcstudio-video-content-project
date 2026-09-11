"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { addStylePresetFromTemplateAction } from "@/app/(authenticated)/app/settings/workspace/style-actions";
import { STYLE_PRESET_TEMPLATES } from "@/lib/domain/style-preset-templates";

/**
 * Starting points, not a fixed menu. Adding one copies its wording into an
 * ordinary style owned by this workspace, which is then edited like any other.
 *
 * `suitsRealisticPeople` is surfaced because it is the single distinction a
 * creator most often needs and cannot see from a name: a style whose exclusions
 * forbid photorealism will never produce a believable person, however the
 * scene is described.
 */
export function StylePresetTemplatePicker({
  existingNames,
  onAdded,
}: {
  existingNames: string[];
  onAdded: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const taken = new Set(existingNames.map((name) => name.toLowerCase()));

  function add(templateKey: string) {
    setAddingKey(templateKey);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("templateKey", templateKey);
      const result = await addStylePresetFromTemplateAction(formData);
      setAddingKey(null);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      onAdded();
    });
  }

  return (
    <div>
      <h3 className="text-sm font-medium">Start from a template</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Each one is a starting point you can edit afterwards. Adding the same
        template twice is fine.
      </p>

      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {STYLE_PRESET_TEMPLATES.map((entry) => (
          <li
            className="flex flex-col justify-between gap-3 rounded-lg border p-3"
            key={entry.key}
          >
            <div>
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {entry.name}
                {entry.suitsRealisticPeople ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                    Real people
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {entry.description}
              </p>
            </div>
            <Button
              className="self-start"
              disabled={addingKey !== null}
              onClick={() => add(entry.key)}
              size="sm"
              type="button"
              variant="outline"
            >
              {addingKey === entry.key
                ? "Adding..."
                : taken.has(entry.name.toLowerCase())
                  ? "Add another copy"
                  : "Add to workspace"}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
