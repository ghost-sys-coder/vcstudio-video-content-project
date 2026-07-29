"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { runCharacterAnimationCheckAction } from "@/app/(authenticated)/app/characters/actions";
import { AnimationCheckRowItem } from "@/components/characters/AnimationCheckRowItem";
import { AnimationPoseMeasurements } from "@/components/characters/AnimationPoseMeasurements";
import { AnimationPoseThumbnails } from "@/components/characters/AnimationPoseThumbnails";
import { CharacterAnimationStage } from "@/components/characters/CharacterAnimationStage";
import { Button } from "@/components/ui/button";
import type { CharacterAnimationCheckView } from "@/lib/characters/animation-check-view";

type CheckState =
  | { status: "idle" }
  | { status: "ready"; view: CharacterAnimationCheckView }
  | { status: "error"; message: string };

/**
 * Pre-flight test for animated video: does this character actually animate?
 *
 * Deliberately explicit rather than implicit. Setting a project to animated
 * commits to regenerating its scene images as character-free background plates,
 * and a pose set that turns out not to be cut out wastes that money and the
 * render behind it. Running this first is cheap — no generation, no provider
 * call, just reading back what is already stored.
 */
export function CharacterAnimationCheckSection({
  characterId,
}: {
  characterId: string;
}) {
  const [state, setState] = useState<CheckState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  function runCheck() {
    startTransition(async () => {
      const data = new FormData();
      data.set("characterId", characterId);
      const result = await runCharacterAnimationCheckAction(data);
      setState(
        result.success
          ? { status: "ready", view: result.view }
          : { status: "error", message: result.error },
      );
    });
  }

  const view = state.status === "ready" ? state.view : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Animation check</h2>
          <p className="text-sm text-muted-foreground">
            Reads back this character&apos;s four pose stills, measures whether
            they are genuinely cut out, and plays them through the same sprite a
            rendered video uses. Run it before setting a project up as an
            animated video.
          </p>
        </div>
        <Button
          disabled={pending}
          onClick={runCheck}
          size="sm"
          type="button"
          variant={state.status === "idle" ? "default" : "outline"}
        >
          {pending ? (
            <>
              <Loader2Icon aria-hidden className="animate-spin" />
              Checking…
            </>
          ) : state.status === "idle" ? (
            "Run animation check"
          ) : (
            "Run again"
          )}
        </Button>
      </div>

      <div aria-live="polite" className="space-y-4">
        {state.status === "error" ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {state.message}
          </p>
        ) : null}

        {view ? (
          <>
            <p
              className={
                view.ready
                  ? "rounded-xl border border-emerald-600/40 bg-emerald-600/5 p-4 text-sm text-emerald-700 dark:text-emerald-500"
                  : "rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
              }
            >
              {view.ready
                ? `${view.characterName} is ready to animate. Every pose is present, cut out, and the right size.`
                : `${view.characterName} will not animate correctly yet. Fix the failing checks below before building an animated project on this character.`}
            </p>

            <ul className="space-y-2">
              {view.checks.map((row) => (
                <AnimationCheckRowItem key={row.id} row={row} />
              ))}
            </ul>

            <AnimationPoseThumbnails poses={view.poses} />

            <AnimationPoseMeasurements poses={view.poses} />

            {view.canPreview ? (
              <CharacterAnimationStage
                characterId={view.characterId}
                key={view.poses[0]?.previewUrl ?? view.characterId}
                poses={view.poses}
              />
            ) : (
              <p className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                The sprite cannot be played until all four poses are generated.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              This checks the character only. A finished animated video also
              needs the project set to Animated characters, and each scene needs
              its characters staged with one marked as speaking.
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
