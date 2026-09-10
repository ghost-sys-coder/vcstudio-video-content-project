import type { VideoContentPlatform } from "@/lib/platforms/video-content-platforms";

/**
 * What a release package is for: one output, going to one destination.
 *
 * A long-form video and each of its Shorts are packaged separately, and two
 * channels on the same platform never share a copy. That separation is the
 * whole point: publishing metadata used to be held per platform in a form, so
 * two YouTube channels overwrote each other and a reload lost the work.
 */
export interface ReleaseTarget {
  outputVariantId: string;
  /** Set when the package is for one Short rather than the whole output. */
  shortCompositionId: string | null;
}

export interface ReleaseDestination {
  platform: VideoContentPlatform;
  /** The channel this goes to. Null means the channel is not chosen yet. */
  channelProfileId: string | null;
}

/**
 * A stable key for one package.
 *
 * Used to address a package in the browser without a round trip. It mirrors the
 * database's `release_packages_destination_unique` constraint exactly, so the
 * two cannot disagree about what counts as the same package.
 */
export function releasePackageKey(input: {
  target: ReleaseTarget;
  destination: ReleaseDestination;
}): string {
  return [
    input.target.outputVariantId,
    input.target.shortCompositionId ?? "-",
    input.destination.platform,
    input.destination.channelProfileId ?? "-",
  ].join("|");
}

/** Names the destination so a creator can confirm it before dispatching. */
export function describeReleaseDestination(input: {
  platformLabel: string;
  channelName: string | null;
}): string {
  return input.channelName
    ? `${input.platformLabel} · ${input.channelName}`
    : `${input.platformLabel} · no channel chosen`;
}

export type ReleasePackageBlockerCode =
  | "title_missing"
  | "caption_missing"
  | "thumbnail_unavailable"
  | "no_render"
  | "stale_render";

export interface ReleasePackageBlocker {
  code: ReleasePackageBlockerCode;
  message: string;
}

export type ReleasePackageStatus = "incomplete" | "stale" | "ready";

export interface ReleasePackageState {
  status: ReleasePackageStatus;
  blockers: ReleasePackageBlocker[];
  /** Whether this package may be dispatched as it stands. */
  canDispatch: boolean;
}

/**
 * Whether a package is ready to be sent, and what is stopping it.
 *
 * Staleness is deliberately expressed against the render: a package is
 * confirmed against one exact render, so when a newer one exists the source
 * content moved underneath the packaging and the creator has to look again
 * before it can be dispatched. Nothing here reconfirms on its own — silently
 * adopting the newer render would defeat the check it exists to perform.
 *
 * Platform metadata beyond the caption is validated where it already is, at
 * dispatch. Restating those rules here would create a second source of truth
 * that can drift from the constraints the database actually enforces.
 */
export function resolveReleasePackageState(input: {
  platform: VideoContentPlatform;
  title: string;
  caption: string | null;
  /** A thumbnail was explicitly chosen. */
  thumbnailChosen: boolean;
  /** That chosen thumbnail still exists and is usable. */
  thumbnailAvailable: boolean;
  /** The newest succeeded render for this target, if any. */
  latestRenderId: string | null;
  /** The render this package was last confirmed against. */
  reviewedRenderId: string | null;
}): ReleasePackageState {
  const blockers: ReleasePackageBlocker[] = [];

  if (input.title.trim() === "")
    blockers.push({
      code: "title_missing",
      message: "Choose or write a title before releasing.",
    });

  if (input.platform === "instagram" && (input.caption ?? "").trim() === "")
    blockers.push({
      code: "caption_missing",
      message: "Instagram needs a caption before releasing.",
    });

  // Only a chosen-then-lost thumbnail is a problem. Not choosing one is a
  // legitimate decision on platforms that do not require a custom cover.
  if (input.thumbnailChosen && !input.thumbnailAvailable)
    blockers.push({
      code: "thumbnail_unavailable",
      message:
        "The thumbnail this release used is gone. Choose another before releasing.",
    });

  if (!input.latestRenderId)
    blockers.push({
      code: "no_render",
      message: "Render the video before releasing it.",
    });
  else if (input.reviewedRenderId !== input.latestRenderId)
    blockers.push({
      code: "stale_render",
      message: input.reviewedRenderId
        ? "A newer render exists. Review this package against it before releasing."
        : "Review this package against the render before releasing.",
    });

  const stale = blockers.some(
    (blocker) =>
      blocker.code === "stale_render" ||
      blocker.code === "thumbnail_unavailable",
  );
  const status: ReleasePackageStatus =
    blockers.length === 0 ? "ready" : stale ? "stale" : "incomplete";

  return { status, blockers, canDispatch: blockers.length === 0 };
}

/**
 * The title a release will actually use.
 *
 * A package's own title wins whenever it has one, even if a different
 * suggestion is favourited afterwards. Favourites are suggestions: a release
 * that quietly followed the newest favourite would publish something nobody
 * chose. A suggestion is only offered as a starting point for a package that
 * has no title yet.
 */
export function resolveReleaseTitle(input: {
  packageTitle: string;
  suggestions: { id: string; text: string; isFavorite: boolean }[];
}): { title: string; source: "chosen" | "suggested" | "none" } {
  if (input.packageTitle.trim() !== "")
    return { title: input.packageTitle, source: "chosen" };
  const favorite = input.suggestions.find(
    (suggestion) => suggestion.isFavorite,
  );
  const offered = favorite ?? input.suggestions[0];
  return offered
    ? { title: offered.text, source: "suggested" }
    : { title: "", source: "none" };
}

/** The revision number a freeze should write next. */
export function nextReleaseRevisionNumber(
  frozenRevisionNumbers: number[],
): number {
  return (
    frozenRevisionNumbers.reduce(
      (highest, current) => (current > highest ? current : highest),
      0,
    ) + 1
  );
}
