"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CueTimingRow } from "@/components/subtitles/CueTimingRow";
import {
  adjustCueBoundary,
  editCueText,
  findCueProblem,
  mergeCueWithNext,
  splitCue,
  type CaptionCue,
  type CueBounds,
  type CueEditResult,
} from "@/lib/subtitles/cue-editing";
import { describeCueTimingSource } from "@/lib/subtitles/cue-timing-source";
import type {
  SubtitleSceneSummaryView,
  SubtitleSegmentView,
} from "@/lib/subtitles/subtitle-view";
import {
  clearCaptionCuesAction,
  saveCaptionCuesAction,
} from "@/app/(authenticated)/app/projects/[projectId]/subtitles/cue-actions";

/**
 * Hand-correcting the caption times for one scene.
 *
 * **The editor refuses an impossible edit rather than repairing it.** Every
 * operation goes through `cue-editing.ts`, which returns the reason a change
 * cannot be made, and that reason is shown in place with the cues left exactly
 * as they were. Silently clamping a dragged boundary would move a line the
 * person did not touch.
 *
 * **Times shown here are relative to this scene's own narration.** The track
 * above shows absolute project times; a correction is a statement about a
 * recording, so it is stored and edited against that recording and survives an
 * earlier scene changing length.
 *
 * The same checks run again on the server, because nothing the browser sends is
 * trusted to be sound.
 */
export function SceneCueTimingEditor({
  projectId,
  scene,
  segments,
  canManage,
  minimumCueDurationMilliseconds,
  onSaved,
}: {
  projectId: string;
  scene: SubtitleSceneSummaryView;
  segments: SubtitleSegmentView[];
  canManage: boolean;
  minimumCueDurationMilliseconds: number;
  onSaved: () => void;
}) {
  const bounds: CueBounds = {
    sceneDurationMilliseconds: scene.audioDurationMilliseconds,
    minimumCueDurationMilliseconds,
  };
  const derived: CaptionCue[] = segments.map((segment) => ({
    text: segment.text,
    startMilliseconds: segment.startMilliseconds - scene.sceneStartMilliseconds,
    endMilliseconds: segment.endMilliseconds - scene.sceneStartMilliseconds,
  }));

  const [cues, setCues] = useState<CaptionCue[]>(derived);
  const [message, setMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  // The track was rebuilt underneath us (granularity change, new narration).
  // Adopting it is only safe while nothing is half-edited, which is why the
  // dirty flag guards it rather than a timestamp comparison.
  const signature = derived
    .map((cue) => `${cue.text}@${cue.startMilliseconds}`)
    .join("|");
  const [seenSignature, setSeenSignature] = useState(signature);
  if (signature !== seenSignature && !dirty) {
    setSeenSignature(signature);
    setCues(derived);
  }

  function apply(result: CueEditResult) {
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setMessage(null);
    setDirty(true);
    setCues(result.cues);
  }

  function save() {
    const audioGenerationId = scene.audioGenerationId;
    if (!audioGenerationId) return;
    const problem = findCueProblem(cues, bounds);
    if (problem) {
      setMessage(problem);
      return;
    }
    startTransition(async () => {
      const result = await saveCaptionCuesAction({
        projectId,
        sceneVersionId: scene.sceneVersionId,
        audioGenerationId,
        expectedRevision: scene.cueRevision,
        cues,
      });
      if (result.status === "error") {
        setMessage(result.message);
        return;
      }
      setMessage(null);
      setDirty(false);
      onSaved();
    });
  }

  function reset() {
    const audioGenerationId = scene.audioGenerationId;
    if (!audioGenerationId) return;
    startTransition(async () => {
      const result = await clearCaptionCuesAction({
        projectId,
        sceneVersionId: scene.sceneVersionId,
        audioGenerationId,
      });
      if (result.status === "error") {
        setMessage(result.message);
        return;
      }
      setMessage(null);
      setDirty(false);
      onSaved();
    });
  }

  if (!scene.audioGenerationId || scene.audioDurationMilliseconds <= 0)
    return (
      <p className="text-xs text-muted-foreground">
        Caption times can be corrected once this scene has approved narration
        with a measured length.
      </p>
    );

  const described = describeCueTimingSource(scene.timingSource);
  return (
    <section
      aria-label={`Scene ${scene.sceneNumber} caption timing`}
      className="space-y-3"
    >
      <div>
        <p className="text-xs font-medium">{described.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Times are seconds from the start of this scene&rsquo;s narration.
        </p>
      </div>

      {message ? (
        <p className="text-xs text-rose-600 dark:text-rose-400" role="alert">
          {message}
        </p>
      ) : null}

      <ul className="space-y-2">
        {cues.map((cue, index) => (
          <CueTimingRow
            canMerge={index < cues.length - 1}
            cue={cue}
            disabled={!canManage || pending}
            index={index}
            key={index}
            onChangeText={(text) =>
              apply(editCueText({ cues, index, text, bounds }))
            }
            onChangeTime={(edge, milliseconds) =>
              apply(
                adjustCueBoundary({ cues, index, edge, milliseconds, bounds }),
              )
            }
            onMerge={() => apply(mergeCueWithNext({ cues, index, bounds }))}
            onSplit={(atCharacter) =>
              apply(splitCue({ cues, index, atCharacter, bounds }))
            }
          />
        ))}
      </ul>

      {canManage ? (
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending || !dirty}
            onClick={save}
            size="sm"
            type="button"
          >
            Save these times
          </Button>
          {scene.cueRevision !== null ? (
            <Button
              disabled={pending}
              onClick={reset}
              size="sm"
              type="button"
              variant="outline"
            >
              Discard corrections
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
