import { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  Img,
  useBufferState,
  useCurrentFrame,
} from "remotion";
import { recordPreviewEvent } from "@/lib/render/preview-telemetry";
import {
  DEFAULT_SCENE_FRAMING,
  framingObjectPosition,
  framingScale,
  type SceneFramingData,
} from "@/lib/output-variants/scene-framing";

/**
 * Renders a scene's approved still, cover-fitted to the frame so it fills the
 * output at any supported aspect ratio without distortion.
 *
 * In the browser preview it also participates in Remotion's buffer state: while
 * the still has not decoded and the scene is actually on screen, it holds
 * playback (so a not-yet-ready image never flashes) and reports readiness to the
 * preview telemetry. The delay is scoped to the player and to active frames so
 * it never stalls the headless render and never pauses the outgoing scene while
 * this one is only premounting (premounted frames are negative).
 */
export function SceneImage({
  src,
  sceneId,
  framing,
}: {
  src: string;
  sceneId: string;
  framing?: SceneFramingData;
}) {
  const effectiveFraming = framing ?? DEFAULT_SCENE_FRAMING;
  const frame = useCurrentFrame();
  const { delayPlayback } = useBufferState();
  const [loaded, setLoaded] = useState(false);
  const delayHandle = useRef<{ unblock: () => void } | null>(null);
  const isPlayer = getRemotionEnvironment().isPlayer;
  const isActive = frame >= 0;

  useEffect(() => {
    if (!isPlayer) return;
    if (loaded || !isActive) {
      delayHandle.current?.unblock();
      delayHandle.current = null;
      return;
    }
    if (!delayHandle.current) delayHandle.current = delayPlayback();
    return () => {
      delayHandle.current?.unblock();
      delayHandle.current = null;
    };
  }, [isPlayer, isActive, loaded, delayPlayback]);

  return (
    <AbsoluteFill style={{ backgroundColor: effectiveFraming.backgroundColor }}>
      <Img
        src={src}
        onLoad={() => {
          setLoaded(true);
          if (isPlayer)
            recordPreviewEvent({
              type: "decode-complete",
              assetUrl: src,
              assetType: "image",
              sceneId,
              currentFrame: frame,
            });
        }}
        onError={() => {
          setLoaded(true);
          if (isPlayer)
            recordPreviewEvent({
              type: "asset-error",
              assetUrl: src,
              assetType: "image",
              sceneId,
              detail: "image failed to load",
            });
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit: effectiveFraming.mode === "contain" ? "contain" : "cover",
          objectPosition: framingObjectPosition(effectiveFraming),
          transform: `scale(${framingScale(effectiveFraming.scaleBps)})`,
        }}
      />
    </AbsoluteFill>
  );
}
