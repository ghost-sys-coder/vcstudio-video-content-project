/**
 * Turns a render's source association (long-form export, repurposed aspect
 * variant, or named short) into the labels the publish picker shows. Pure and
 * unit-tested so the three render kinds are always identifiable and sort into a
 * stable, scannable order.
 */

export type PublishableRenderKind = "short" | "variant" | "longform";

export type RenderSourceDescription = {
  kind: PublishableRenderKind;
  /** Section heading, e.g. "Shorts", "Repurposed variants", "Full video". */
  groupLabel: string;
  /** The specific name of the short/variant, or null for long-form. */
  sourceName: string | null;
};

const GROUP_LABELS: Record<PublishableRenderKind, string> = {
  short: "Shorts",
  variant: "Repurposed variants",
  longform: "Full video",
};

/** Ascending sort weight so shorts lead, then variants, then long-form. */
export const RENDER_KIND_ORDER: Record<PublishableRenderKind, number> = {
  short: 0,
  variant: 1,
  longform: 2,
};

export function classifyRenderSource(input: {
  shortName: string | null;
  variantName: string | null;
}): RenderSourceDescription {
  const shortName = input.shortName?.trim() ?? "";
  if (shortName !== "")
    return {
      kind: "short",
      groupLabel: GROUP_LABELS.short,
      sourceName: shortName,
    };

  const variantName = input.variantName?.trim() ?? "";
  if (variantName !== "")
    return {
      kind: "variant",
      groupLabel: GROUP_LABELS.variant,
      sourceName: variantName,
    };

  return {
    kind: "longform",
    groupLabel: GROUP_LABELS.longform,
    sourceName: null,
  };
}

/** Duration as `m:ss`, or `h:mm:ss` once it reaches an hour. */
export function formatRenderClock(durationMilliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMilliseconds / 1000));
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (value: number) => value.toString().padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

/**
 * Concise one-line label for the closed Select trigger, where the group heading
 * is not visible — so the kind is named inline (e.g.
 * `Short · short-testing — 1080×1920 · 0:02`).
 */
export function buildRenderOptionLabel(input: {
  kind: PublishableRenderKind;
  sourceName: string | null;
  width: number;
  height: number;
  durationMilliseconds: number;
}): string {
  const dimensions = `${input.width}×${input.height}`;
  const clock = formatRenderClock(input.durationMilliseconds);
  const kindWord =
    input.kind === "short"
      ? "Short"
      : input.kind === "variant"
        ? "Repurposed"
        : "Full video";
  const named =
    input.sourceName !== null ? `${kindWord} · ${input.sourceName}` : kindWord;
  return `${named} — ${dimensions} · ${clock}`;
}
