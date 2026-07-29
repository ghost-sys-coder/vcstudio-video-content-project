import { AbsoluteFill } from "remotion";

/** Edge length of one checker square, in composition pixels. */
const SQUARE_SIZE = 48;
const HALF = SQUARE_SIZE / 2;

/**
 * Deliberately saturated rather than the conventional grey-on-white checker.
 * Generated pose backgrounds are overwhelmingly white, grey, or a pale studio
 * wash, and a light grey box on a light grey checkerboard is easy to look
 * straight past — which defeats the point. Against these, an opaque plate is
 * impossible to miss.
 */
const LIGHT = "#c7d2fe";
const DARK = "#6366f1";

/**
 * The transparency checkerboard behind the character animation check.
 *
 * A scene plate would hide the exact defect the check is looking for — a pose
 * whose background was painted in rather than cut out reads as "a character in
 * front of a picture" over artwork, but as an unmistakable opaque box over
 * this.
 */
export function CheckerboardBackdrop() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: LIGHT,
        backgroundImage: [
          `linear-gradient(45deg, ${DARK} 25%, transparent 25%)`,
          `linear-gradient(-45deg, ${DARK} 25%, transparent 25%)`,
          `linear-gradient(45deg, transparent 75%, ${DARK} 75%)`,
          `linear-gradient(-45deg, transparent 75%, ${DARK} 75%)`,
        ].join(", "),
        backgroundSize: `${SQUARE_SIZE}px ${SQUARE_SIZE}px`,
        backgroundPosition: `0 0, 0 ${HALF}px, ${HALF}px -${HALF}px, -${HALF}px 0`,
      }}
    />
  );
}
