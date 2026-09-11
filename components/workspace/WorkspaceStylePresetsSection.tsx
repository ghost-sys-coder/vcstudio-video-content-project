"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StylePresetForm } from "@/components/workspace/StylePresetForm";
import { StylePresetRow } from "@/components/workspace/StylePresetRow";
import { StylePresetTemplatePicker } from "@/components/workspace/StylePresetTemplatePicker";
import { createStylePresetAction } from "@/app/(authenticated)/app/settings/workspace/style-actions";
import type { StylePresetSettingsView } from "@/lib/styles/style-preset-view";

/**
 * The workspace's visual styles.
 *
 * Every action here writes through a server action and then refreshes the
 * route, so the list is always the database's answer rather than an optimistic
 * copy that can drift from it. Styles are workspace-wide: a project picks one
 * when it is created, and a single generation may still override that choice.
 */
export function WorkspaceStylePresetsSection({
  canManage,
  presets,
}: {
  canManage: boolean;
  presets: StylePresetSettingsView[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const active = presets.filter((preset) => !preset.isArchived);
  const archived = presets.filter((preset) => preset.isArchived);

  function refresh() {
    router.refresh();
  }

  return (
    <section className="rounded-2xl border bg-background p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Visual styles</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A style is the look every scene image in a project is generated in.
            Keep one per niche you produce for, and choose one when you create a
            project.
          </p>
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                setShowTemplates((value) => !value);
                setCreating(false);
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              {showTemplates ? "Hide templates" : "Templates"}
            </Button>
            <Button
              onClick={() => {
                setCreating((value) => !value);
                setShowTemplates(false);
              }}
              size="sm"
              type="button"
            >
              {creating ? "Cancel" : "New style"}
            </Button>
          </div>
        ) : null}
      </div>

      {canManage ? null : (
        <p className="mt-4 text-sm text-muted-foreground">
          Only owners and editors can change visual styles.
        </p>
      )}

      {creating ? (
        <div className="mt-4 rounded-lg border bg-muted/30 p-4">
          <StylePresetForm
            action={createStylePresetAction}
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              refresh();
            }}
            preset={null}
            submitLabel="Create style"
          />
        </div>
      ) : null}

      {showTemplates ? (
        <div className="mt-4 rounded-lg border bg-muted/30 p-4">
          <StylePresetTemplatePicker
            existingNames={presets.map((preset) => preset.name)}
            onAdded={() => {
              setShowTemplates(false);
              refresh();
            }}
          />
        </div>
      ) : null}

      <ul className="mt-4 divide-y rounded-lg border">
        {active.map((preset) => (
          <StylePresetRow
            canManage={canManage}
            key={preset.id}
            onChanged={refresh}
            preset={preset}
          />
        ))}
      </ul>

      {archived.length ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            Archived styles ({archived.length})
          </summary>
          <ul className="mt-2 divide-y rounded-lg border">
            {archived.map((preset) => (
              <StylePresetRow
                canManage={canManage}
                key={preset.id}
                onChanged={refresh}
                preset={preset}
              />
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
