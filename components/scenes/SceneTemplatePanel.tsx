"use client";

import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/CopyButton";
import {
  SCENE_ARRAY_TEMPLATE_FILENAME,
  SCENE_ARRAY_TEMPLATE_JSON,
  SCENE_FIELD_GUIDE,
  SCENE_TEMPLATE_FILENAME,
  SCENE_TEMPLATE_JSON,
} from "@/lib/scenes/scene-template";

/**
 * Hands over the shape of a scene, to copy or to keep.
 *
 * Both routes exist because they suit different moments. Copying suits editing
 * one scene in whatever is already open; downloading suits drafting a whole
 * plan in a file and bringing it back later. Neither asks the creator to
 * reconstruct twelve field names from memory, which is the actual barrier to
 * writing a plan outside this application.
 */
export function SceneTemplatePanel({
  onUseTemplate,
}: {
  /** Drops the template straight into the paste box, skipping the clipboard. */
  onUseTemplate: (template: string) => void;
}) {
  function download(contents: string, filename: string) {
    const url = URL.createObjectURL(
      new Blob([contents], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    // Released on the next turn of the loop: revoking before the click is
    // handled leaves the browser downloading nothing at all.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
      <div>
        <p className="text-sm font-medium">Start from the template</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Every field a scene has. Fill it in wherever you like and paste it
          back below — one scene, or a list of them.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => onUseTemplate(SCENE_TEMPLATE_JSON)}
          size="sm"
          type="button"
          variant="outline"
        >
          Use one scene
        </Button>
        <Button
          onClick={() => onUseTemplate(SCENE_ARRAY_TEMPLATE_JSON)}
          size="sm"
          type="button"
          variant="outline"
        >
          Use a list
        </Button>
        <CopyButton label="scene template" value={SCENE_TEMPLATE_JSON} />
        <Button
          onClick={() => download(SCENE_TEMPLATE_JSON, SCENE_TEMPLATE_FILENAME)}
          size="sm"
          type="button"
          variant="ghost"
        >
          <DownloadIcon aria-hidden className="size-4" />
          Scene
        </Button>
        <Button
          onClick={() =>
            download(SCENE_ARRAY_TEMPLATE_JSON, SCENE_ARRAY_TEMPLATE_FILENAME)
          }
          size="sm"
          type="button"
          variant="ghost"
        >
          <DownloadIcon aria-hidden className="size-4" />
          List
        </Button>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          What each field means
        </summary>
        <dl className="mt-2 space-y-1.5">
          {SCENE_FIELD_GUIDE.map((entry) => (
            <div className="flex flex-wrap gap-x-2" key={entry.field}>
              <dt className="font-mono text-[11px] text-foreground">
                {entry.field}
                {entry.required ? null : (
                  <span className="ml-1 font-sans text-muted-foreground">
                    optional
                  </span>
                )}
              </dt>
              <dd className="min-w-0 flex-1 text-muted-foreground">
                {entry.description}
              </dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
