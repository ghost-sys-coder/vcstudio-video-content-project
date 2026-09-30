import type { NarrationPart } from "@/lib/audio/narration-directives";
import type { SceneAudioFormat } from "@/lib/schemas/scene-audio";

export interface SpokenClip {
  bytes: Buffer;
  contentType: string;
  format: SceneAudioFormat;
  requestId: string | null;
  characterCount: number;
}

/**
 * A speech request failed after earlier segments of the same scene were
 * already voiced, so the provider has been paid for some of this narration
 * even though none of it will be kept.
 */
export class NarrationSegmentFailure extends Error {
  constructor(
    readonly cause: unknown,
    readonly completedSegments: number,
  ) {
    super("NARRATION_SEGMENT_FAILED");
    this.name = "NarrationSegmentFailure";
  }
}

/**
 * Voices a scene's narration, honouring its pauses exactly.
 *
 * Without pauses this is one request in the preset's format — precisely what
 * happened before pauses existed. With them, each spoken part is voiced on its
 * own, as WAV so it can be joined without a lossy decode, and `join` stitches
 * the parts together with silences of the written length and encodes once into
 * the preset's format.
 *
 * Each part carries the scene's full delivery direction, so tone holds across
 * a pause; a model still starts each part fresh, which is the one audible cost
 * of an exact pause.
 *
 * `raisedGainDb`, when given, also voices each `[RAISE]` span on its own and
 * turns it up by that many decibels: guaranteed louder, at the cost of the
 * sentence being voiced in pieces. Without it, raised spans stay inside their
 * sentence and are asked for in the direction only.
 */
export async function synthesizeSceneNarration(input: {
  parts: NarrationPart[];
  format: SceneAudioFormat;
  speak: (text: string, format: SceneAudioFormat) => Promise<SpokenClip>;
  join: (
    parts: (
      | { kind: "clip"; bytes: Buffer; gainDb?: number }
      | { kind: "silence"; milliseconds: number }
    )[],
    format: SceneAudioFormat,
  ) => Promise<Buffer>;
  contentTypeFor: (format: SceneAudioFormat) => string;
  raisedGainDb?: number;
}): Promise<SpokenClip> {
  const speech = input.parts.filter((part) => part.kind === "speech");
  const hasPause = input.parts.some((part) => part.kind === "pause");
  const boosting =
    input.raisedGainDb !== undefined &&
    speech.some((part) => part.spans?.some((span) => span.raised));
  if (speech.length === 0) throw new Error("NARRATION_HAS_NO_SPEECH");
  const [only] = speech;
  if (!hasPause && !boosting && speech.length === 1 && only)
    return input.speak(only.text, input.format);

  const joined: (
    | { kind: "clip"; bytes: Buffer; gainDb?: number }
    | { kind: "silence"; milliseconds: number }
  )[] = [];
  const requestIds: string[] = [];
  let characterCount = 0;
  let completed = 0;
  for (const part of input.parts) {
    if (part.kind === "pause") {
      joined.push({ kind: "silence", milliseconds: part.milliseconds });
      continue;
    }
    const pieces =
      boosting && part.spans
        ? withoutBarePunctuation(part.spans)
        : [{ text: part.text, raised: false }];
    for (const piece of pieces) {
      let clip: SpokenClip;
      try {
        clip = await input.speak(piece.text, "wav");
      } catch (error) {
        if (completed === 0) throw error;
        throw new NarrationSegmentFailure(error, completed);
      }
      completed += 1;
      characterCount += clip.characterCount;
      if (clip.requestId) requestIds.push(clip.requestId);
      joined.push(
        piece.raised && input.raisedGainDb !== undefined
          ? { kind: "clip", bytes: clip.bytes, gainDb: input.raisedGainDb }
          : { kind: "clip", bytes: clip.bytes },
      );
    }
  }

  return {
    bytes: await input.join(joined, input.format),
    contentType: input.contentTypeFor(input.format),
    format: input.format,
    // The first request identifies the scene's narration for support; every
    // segment's id is not kept, to stay within the single stored column.
    requestId: requestIds[0] ?? null,
    characterCount,
  };
}

/**
 * A span with no words — the full stop after a raised word — cannot be voiced
 * on its own, so it joins the span before it (or after it, at the start).
 */
function withoutBarePunctuation(
  spans: { text: string; raised: boolean }[],
): { text: string; raised: boolean }[] {
  const merged: { text: string; raised: boolean }[] = [];
  let carried = "";
  for (const span of spans) {
    if (!/[\p{L}\p{N}]/u.test(span.text)) {
      const last = merged.at(-1);
      if (last) last.text = `${last.text}${span.text}`;
      else carried = `${carried}${span.text} `;
      continue;
    }
    merged.push({ text: `${carried}${span.text}`, raised: span.raised });
    carried = "";
  }
  return merged;
}
