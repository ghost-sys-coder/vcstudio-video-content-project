"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { StylePresetForm } from "@/components/workspace/StylePresetForm";
import {
  archiveStylePresetAction,
  restoreStylePresetAction,
  setDefaultStylePresetAction,
  updateStylePresetAction,
} from "@/app/(authenticated)/app/settings/workspace/style-actions";
import type { StylePresetSettingsView } from "@/lib/styles/style-preset-view";

/**
 * One style in the settings list, with its wording visible rather than hidden
 * behind an edit click. The prompt text is the whole substance of a style, and
 * a creator comparing two of them should not have to open both.
 */
export function StylePresetRow({
  canManage,
  onChanged,
  preset,
}: {
  canManage: boolean;
  onChanged: () => void;
  preset: StylePresetSettingsView;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(
    action: (formData: FormData) => Promise<{ error: string | null }>,
  ) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("stylePresetId", preset.id);
      const result = await action(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      onChanged();
    });
  }

  return (
    <li className="px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <span className="truncate">{preset.name}</span>
            <span className="text-xs font-normal text-muted-foreground">
              v{preset.version}
            </span>
            {preset.isDefault ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
                Workspace default
              </span>
            ) : null}
            {preset.isArchived ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                Archived
              </span>
            ) : null}
          </p>
          {preset.description ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {preset.description}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted-foreground">
            {preset.defaultAspectRatio} · updated {preset.updatedAtLabel}
          </p>
        </div>

        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            {preset.isArchived ? (
              <Button
                disabled={pending}
                onClick={() => run(restoreStylePresetAction)}
                size="sm"
                type="button"
                variant="outline"
              >
                Restore
              </Button>
            ) : (
              <>
                <Button
                  disabled={pending}
                  onClick={() => setEditing((value) => !value)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {editing ? "Close" : "Edit"}
                </Button>
                {preset.isDefault ? null : (
                  <>
                    <Button
                      disabled={pending}
                      onClick={() => run(setDefaultStylePresetAction)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Make default
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() => run(archiveStylePresetAction)}
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      Archive
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          Prompt wording
        </summary>
        <dl className="mt-2 space-y-2 text-xs">
          <div>
            <dt className="font-medium">Visual direction</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
              {preset.positivePrompt}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Keep out</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-muted-foreground">
              {preset.negativePrompt || "Nothing excluded."}
            </dd>
          </div>
        </dl>
      </details>

      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {editing ? (
        <div className="mt-4 rounded-lg border bg-muted/30 p-4">
          <p className="mb-3 text-xs text-muted-foreground">
            Saving adds version {preset.version + 1}. Images already generated
            keep the wording they were made with.
          </p>
          <StylePresetForm
            action={updateStylePresetAction}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              onChanged();
            }}
            preset={preset}
            submitLabel="Save as new version"
          />
        </div>
      ) : null}
    </li>
  );
}
