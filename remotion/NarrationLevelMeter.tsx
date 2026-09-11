import { AbsoluteFill, useCurrentFrame } from "remotion";

/** Bars drawn in the meter. */
const BAR_COUNT = 5;

/**
 * How much each bar lags the one before it, as a fraction of a frame's worth
 * of envelope. Bars that all moved together would read as one block changing
 * height; a small stagger makes it read as a level meter.
 */
const BAR_LAG_FRAMES = 2;

/** Height of the shortest bar, so a silent meter is still visible. */
const MINIMUM_SCALE = 0.16;

const POSITION_STYLE = {
  bottomLeft: { bottom: "6%", left: "5%" },
  bottomCenter: { bottom: "6%", left: "50%", transform: "translateX(-50%)" },
  bottomRight: { bottom: "6%", right: "5%" },
  topLeft: { top: "6%", left: "5%" },
  topCenter: { top: "6%", left: "50%", transform: "translateX(-50%)" },
  topRight: { top: "6%", right: "5%" },
} as const;

export type NarrationLevelMeterPosition = keyof typeof POSITION_STYLE;

/**
 * Draws bars that rise and fall with the narration's measured loudness.
 *
 * The envelope is the same measurement that drives animated mouth movement: it
 * is produced once with ffmpeg when the narration is generated, already
 * resampled to one value per frame of this scene by the time it arrives here.
 * So this reflects the recording rather than approximating it, and costs
 * nothing to compute.
 *
 * It shows *loudness*, not speech. A cough, a held breath or a loud room all
 * move it, because the measurement cannot tell them from a word.
 *
 * A scene with no measured envelope renders nothing at all rather than an
 * idle meter, since a meter frozen at zero under audible narration would read
 * as a fault in the video.
 */
export function NarrationLevelMeter({
  envelope,
  position,
}: {
  envelope: number[];
  position: NarrationLevelMeterPosition;
}) {
  const frame = useCurrentFrame();
  if (envelope.length === 0) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          display: "flex",
          alignItems: "flex-end",
          gap: "0.6vw",
          height: "7vh",
          ...POSITION_STYLE[position],
        }}
      >
        {Array.from({ length: BAR_COUNT }, (_, index) => {
          const sampleFrame = Math.max(0, frame - index * BAR_LAG_FRAMES);
          const level =
            envelope[Math.min(sampleFrame, envelope.length - 1)] ?? 0;
          const scale = MINIMUM_SCALE + (1 - MINIMUM_SCALE) * level;
          return (
            <div
              key={index}
              style={{
                width: "0.9vw",
                height: `${Math.round(scale * 100)}%`,
                borderRadius: "0.45vw",
                backgroundColor: "rgba(255, 255, 255, 0.88)",
                boxShadow: "0 0 0.4vw rgba(0, 0, 0, 0.35)",
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
