import { useEffect, useRef, useState } from "react";
import {
  getRemotionEnvironment,
  Img,
  useBufferState,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { recordPreviewEvent } from "@/lib/render/preview-telemetry";
import type { VideoCompositionSceneCharacter } from "@/lib/render/video-composition-data";

// Amplitude (0..1, measured from the narration audio, never fabricated) at or
// above this is read as "actively talking".
const TALK_AMPLITUDE_THRESHOLD = 0.12;
const BLINK_INTERVAL_SECONDS = 4;
const BLINK_DURATION_FRAMES = 3;

/** Share of the frame height a standing character occupies. */
const SPRITE_HEIGHT_RATIO = 0.82;

/** Horizontal centre of each stage slot, as a share of frame width. */
const STAGE_SLOT_CENTER: Record<
  VideoCompositionSceneCharacter["stageSlot"],
  number
> = {
  left: 0.27,
  center: 0.5,
  right: 0.73,
};

type PoseKind = "idle" | "talkOpen" | "talkClosed" | "blink";

function resolveActivePose(input: {
  frame: number;
  fps: number;
  amplitude: number | null;
  blinkOffsetFrames: number;
}): PoseKind {
  const framesPerBlinkCycle = Math.round(BLINK_INTERVAL_SECONDS * input.fps);
  if (framesPerBlinkCycle > 0) {
    const cyclePosition =
      (((input.frame + input.blinkOffsetFrames) % framesPerBlinkCycle) +
        framesPerBlinkCycle) %
      framesPerBlinkCycle;
    if (cyclePosition < BLINK_DURATION_FRAMES) return "blink";
  }
  if (input.amplitude === null) return "idle";
  return input.amplitude >= TALK_AMPLITUDE_THRESHOLD
    ? "talkOpen"
    : "talkClosed";
}

/**
 * One animated character standing in a scene, drawn over the background plate.
 *
 * All four pose stills are mounted and decoded up front, stacked and
 * opacity-toggled, rather than swapping one `<Img>`'s `src` — src-swapping
 * re-triggers Remotion's decode/buffer-stall logic on every pose change, which
 * stutters at exactly the rate a mouth moves.
 *
 * The talk/idle choice comes from the narration audio's measured amplitude at
 * the current frame, never fabricated timing — the same principle this app
 * applies to subtitle timing. Non-speakers get an empty envelope and so idle
 * and blink. Blinking is a fixed-interval timer offset per character so a cast
 * does not blink in unison.
 */
export function CharacterSprite({
  character,
  sceneId,
  blinkOffsetFrames,
}: {
  character: VideoCompositionSceneCharacter;
  sceneId: string;
  blinkOffsetFrames: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { delayPlayback } = useBufferState();
  const [loadedUrls, setLoadedUrls] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const delayHandle = useRef<{ unblock: () => void } | null>(null);
  const isPlayer = getRemotionEnvironment().isPlayer;
  const isActive = frame >= 0;

  const poses: { kind: PoseKind; url: string }[] = [
    { kind: "idle", url: character.idleUrl },
    { kind: "talkOpen", url: character.talkOpenUrl },
    { kind: "talkClosed", url: character.talkClosedUrl },
    { kind: "blink", url: character.blinkUrl },
  ];
  const allLoaded = poses.every((pose) => loadedUrls.has(pose.url));

  useEffect(() => {
    if (!isPlayer) return;
    if (allLoaded || !isActive) {
      delayHandle.current?.unblock();
      delayHandle.current = null;
      return;
    }
    if (!delayHandle.current) delayHandle.current = delayPlayback();
    return () => {
      delayHandle.current?.unblock();
      delayHandle.current = null;
    };
  }, [isPlayer, isActive, allLoaded, delayPlayback]);

  const amplitude =
    frame >= 0 && frame < character.amplitudeEnvelope.length
      ? (character.amplitudeEnvelope[frame] ?? null)
      : null;
  const activePose = resolveActivePose({
    frame,
    fps,
    amplitude,
    blinkOffsetFrames,
  });

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: `${STAGE_SLOT_CENTER[character.stageSlot] * 100}%`,
        height: `${SPRITE_HEIGHT_RATIO * 100}%`,
        // Translate by half the sprite's own width so the slot value is its
        // centre regardless of how wide the artwork turns out to be, and mirror
        // in the same transform so facing never fights the centring.
        transform: `translateX(-50%)${character.faceLeft ? " scaleX(-1)" : ""}`,
      }}
    >
      {poses.map((pose) => (
        <Img
          key={pose.kind}
          onError={() => {
            setLoadedUrls((current) => new Set(current).add(pose.url));
            if (isPlayer)
              recordPreviewEvent({
                type: "asset-error",
                assetUrl: pose.url,
                assetType: "image",
                sceneId,
                detail: "pose image failed to load",
              });
          }}
          onLoad={() => {
            setLoadedUrls((current) => new Set(current).add(pose.url));
            if (isPlayer)
              recordPreviewEvent({
                type: "decode-complete",
                assetUrl: pose.url,
                assetType: "image",
                sceneId,
                currentFrame: frame,
              });
          }}
          src={pose.url}
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: "100%",
            width: "auto",
            objectFit: "contain",
            opacity: activePose === pose.kind ? 1 : 0,
          }}
        />
      ))}
    </div>
  );
}
