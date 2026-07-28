import { Label } from "@/components/ui/label";
import type { ProjectVideoKind } from "@/db/schema";

/**
 * Chooses whether a project renders AI-generated stills or animated character
 * sprites composited over a background plate.
 *
 * This is a project-level choice on purpose: the two modes were previously
 * mixable per scene, which produced videos where a photoreal still and a flat
 * character sat back to back. Making it a project property means a single video
 * can never contain both.
 */
export function VideoKindSelect({
  defaultValue,
  disabled,
  id,
}: {
  defaultValue: ProjectVideoKind;
  disabled?: boolean;
  id: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Video type</Label>
      <select
        className="h-8 w-full rounded-lg border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        defaultValue={defaultValue}
        disabled={disabled}
        id={id}
        name="videoKind"
      >
        <option value="staticImages">Still images</option>
        <option value="animatedCharacter">Animated characters</option>
      </select>
      <p className="text-xs text-muted-foreground">
        Still images generate one AI image per scene. Animated characters
        generate an empty background for each scene and place your characters on
        top, lip-synced to the narration — every scene uses the same mode.
      </p>
    </div>
  );
}
