import { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  Img,
  useBufferState,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { recordPreviewEvent } from "@/lib/render/preview-telemetry";
import {
  DEFAULT_SCENE_FRAMING,
  framingObjectPosition,
  framingScale,
  type SceneFramingData,
} from "@/lib/output-variants/scene-framing";

// Amplitude (0..1, measured from the narration audio, never fabricated) at or
// above this is read as "actively talking." Both this and the blink timing
// below are Phase 0 defaults meant to be tuned once real pilot output can be
// watched (see the animated-video plan's Phase 0 verification section).
const TALK_AMPLITUDE_THRESHOLD = 0.12;
const BLINK_INTERVAL_SECONDS = 4;
const BLINK_DURATION_FRAMES = 3;

type PoseKind = "idle" | "talkOpen" | "talkClosed" | "blink";

function resolveActivePose(input: {
  frame: number;
  fps: number;
  amplitude: number | null;
}): PoseKind {
  const framesPerBlinkCycle = Math.round(BLINK_INTERVAL_SECONDS * input.fps);
  if (
    framesPerBlinkCycle > 0 &&
    ((input.frame % framesPerBlinkCycle) + framesPerBlinkCycle) %
      framesPerBlinkCycle <
      BLINK_DURATION_FRAMES
  )
    return "blink";
  if (input.amplitude === null) return "idle";
  return input.amplitude >= TALK_AMPLITUDE_THRESHOLD
    ? "talkOpen"
    : "talkClosed";
}

/**
 * Renders an animated character by swapping between four pre-generated pose
 * stills (idle / talk-open / talk-closed / blink) instead of showing one
 * static image. All four are mounted and decoded up front, stacked and
 * opacity-toggled, rather than swapping one `<Img>`'s `src` — src-swapping
 * would re-trigger Remotion's decode/buffer-stall logic on every pose change.
 *
 * The talk/idle choice is driven by the narration audio's measured amplitude
 * at the current frame, never fabricated timing — the same principle this app
 * already applies to subtitle timing. The amplitude envelope itself is
 * computed server-side, once, at render time (see
 * `lib/media/audio-amplitude.ts`) and passed in as a plain array indexed by
 * scene-relative frame — this component never fetches audio itself, since
 * doing so in-browser during rendering requires the asset bucket to serve
 * CORS headers it doesn't have. Blinking is a fixed-interval timer,
 * independent of amplitude.
 */
export function AnimatedCharacterScene({
  sceneId,
  idleUrl,
  talkOpenUrl,
  talkClosedUrl,
  blinkUrl,
  amplitudeEnvelope,
  framing,
}: {
  sceneId: string;
  idleUrl: string;
  talkOpenUrl: string;
  talkClosedUrl: string;
  blinkUrl: string;
  amplitudeEnvelope: number[];
  framing?: SceneFramingData;
}) {
  const effectiveFraming = framing ?? DEFAULT_SCENE_FRAMING;
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
    { kind: "idle", url: idleUrl },
    { kind: "talkOpen", url: talkOpenUrl },
    { kind: "talkClosed", url: talkClosedUrl },
    { kind: "blink", url: blinkUrl },
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
    frame >= 0 && frame < amplitudeEnvelope.length
      ? amplitudeEnvelope[frame]!
      : null;

  const activePose = resolveActivePose({ frame, fps, amplitude });

  return (
    <AbsoluteFill style={{ backgroundColor: effectiveFraming.backgroundColor }}>
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
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit:
              effectiveFraming.mode === "contain" ? "contain" : "cover",
            objectPosition: framingObjectPosition(effectiveFraming),
            transform: `scale(${framingScale(effectiveFraming.scaleBps)})`,
            opacity: activePose === pose.kind ? 1 : 0,
          }}
        />
      ))}
    </AbsoluteFill>
  );
}
