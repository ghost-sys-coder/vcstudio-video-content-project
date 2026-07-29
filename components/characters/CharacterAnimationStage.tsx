"use client";

import { useCallback, useMemo, useState } from "react";
import { Player } from "@remotion/player";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ANIMATION_TEST_DURATION_IN_FRAMES,
  ANIMATION_TEST_FPS,
} from "@/lib/characters/animation-test-envelope";
import { buildAnimationTestCharacter } from "@/lib/characters/build-animation-test-character";
import type { AnimationPoseDiagnostic } from "@/lib/characters/animation-check-view";
import { CharacterAnimationTestComposition } from "@/remotion/CharacterAnimationTestComposition";

const STAGE_WIDTH = 1280;
const STAGE_HEIGHT = 720;

/**
 * Plays the character's own pose stills through the production sprite.
 *
 * The mirror control is not decoration: facing is a CSS mirror rather than
 * separate generated art, so a pose with baked-in text, an asymmetric prop, or a
 * parting on one side only shows up as wrong when it is flipped — and in a
 * two-hander it will be flipped.
 */
export function CharacterAnimationStage({
  characterId,
  poses,
}: {
  characterId: string;
  poses: AnimationPoseDiagnostic[];
}) {
  const [faceLeft, setFaceLeft] = useState(false);

  const character = useMemo(
    () => buildAnimationTestCharacter({ characterId, poses, faceLeft }),
    [characterId, faceLeft, poses],
  );

  const renderPoster = useCallback(
    () => (
      <div className="flex size-full items-center justify-center bg-black/50">
        <Loader2Icon aria-hidden className="size-6 animate-spin text-white" />
      </div>
    ),
    [],
  );

  if (!character) return null;

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border bg-black">
        <Player
          autoPlay
          component={CharacterAnimationTestComposition}
          compositionHeight={STAGE_HEIGHT}
          compositionWidth={STAGE_WIDTH}
          controls
          durationInFrames={ANIMATION_TEST_DURATION_IN_FRAMES}
          fps={ANIMATION_TEST_FPS}
          inputProps={{ character }}
          loop
          posterFillMode="composition-size"
          renderPoster={renderPoster}
          showPosterWhenBuffering
          style={{ width: "100%" }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Six seconds of synthetic speech, then two seconds of silence so the
          idle pose appears. The mouth follows the signal exactly as it follows
          real narration in a render; blinks run on their own timer.
        </p>
        <Button
          onClick={() => setFaceLeft((value) => !value)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {faceLeft ? "Face right" : "Mirror (face left)"}
        </Button>
      </div>
    </div>
  );
}
