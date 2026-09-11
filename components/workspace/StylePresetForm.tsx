"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { StylePresetActionState } from "@/app/(authenticated)/app/settings/workspace/style-actions";
import type { StylePresetSettingsView } from "@/lib/styles/style-preset-view";

const ASPECT_RATIOS = [
  { value: "16:9", label: "16:9 landscape" },
  { value: "9:16", label: "9:16 vertical" },
  { value: "1:1", label: "1:1 square" },
] as const;

/**
 * Creates a style or saves an edit to one.
 *
 * When `preset` is supplied the form carries its id and current version number
 * as hidden fields. The version is the optimistic lock: the server refuses the
 * save if somebody else edited the same style first, rather than appending a
 * version that silently discards their wording.
 */
export function StylePresetForm({
  action,
  onCancel,
  onSaved,
  preset,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<StylePresetActionState>;
  onCancel?: () => void;
  onSaved: () => void;
  preset: StylePresetSettingsView | null;
  submitLabel: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fieldPrefix = preset ? `style-${preset.id}` : "style-new";

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await action(formData);
          if (result.success) {
            setError(null);
            onSaved();
            return;
          }
          setError(result.error);
        })
      }
      className="space-y-4"
    >
      {preset ? (
        <>
          <input name="stylePresetId" type="hidden" value={preset.id} />
          <input
            name="expectedCurrentVersion"
            type="hidden"
            value={preset.version}
          />
        </>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            className="text-sm font-medium"
            htmlFor={`${fieldPrefix}-name`}
          >
            Name
          </label>
          <input
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            defaultValue={preset?.name ?? ""}
            id={`${fieldPrefix}-name`}
            maxLength={80}
            name="name"
            required
            type="text"
          />
        </div>
        <div className="space-y-2">
          <label
            className="text-sm font-medium"
            htmlFor={`${fieldPrefix}-aspect`}
          >
            Default aspect ratio
          </label>
          <select
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
            defaultValue={preset?.defaultAspectRatio ?? "16:9"}
            id={`${fieldPrefix}-aspect`}
            name="defaultAspectRatio"
          >
            {ASPECT_RATIOS.map((ratio) => (
              <option key={ratio.value} value={ratio.value}>
                {ratio.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-medium"
          htmlFor={`${fieldPrefix}-description`}
        >
          Description
        </label>
        <input
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
          defaultValue={preset?.description ?? ""}
          id={`${fieldPrefix}-description`}
          maxLength={600}
          name="description"
          placeholder="What this style is for, so the next person picks it deliberately."
          type="text"
        />
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-medium"
          htmlFor={`${fieldPrefix}-positive`}
        >
          Visual direction
        </label>
        <textarea
          className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          defaultValue={preset?.positivePrompt ?? ""}
          id={`${fieldPrefix}-positive`}
          maxLength={4000}
          name="positivePrompt"
          placeholder="Describe the look: medium, linework, palette, lighting, composition."
          required
        />
        <p className="text-xs text-muted-foreground">
          This is added to every scene image prompt in projects using this
          style. Describe the medium and the light, not the subject.
        </p>
      </div>

      <div className="space-y-2">
        <label
          className="text-sm font-medium"
          htmlFor={`${fieldPrefix}-negative`}
        >
          Keep out
        </label>
        <textarea
          className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          defaultValue={preset?.negativePrompt ?? ""}
          id={`${fieldPrefix}-negative`}
          maxLength={4000}
          name="negativePrompt"
          placeholder="What this style must never produce."
        />
        <p className="text-xs text-muted-foreground">
          Excluding photorealism here makes believable people unreachable in
          this style. Leave it out when you want real-looking humans.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button disabled={pending} size="sm" type="submit">
          {pending ? "Saving..." : submitLabel}
        </Button>
        {onCancel ? (
          <Button
            disabled={pending}
            onClick={onCancel}
            size="sm"
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
