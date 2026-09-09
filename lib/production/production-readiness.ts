/**
 * Derives what a project actually needs next from its current content, assets,
 * jobs, renders and publications.
 *
 * The rule that shapes this whole module: readiness is *evidence*, never a
 * label. `projects.status` is editable by hand in project settings, so it is
 * deliberately absent from the facts below and cannot reach any value here. A
 * project marked "completed" with nothing rendered is not ready, and a project
 * left at "draft" that has a succeeded render is.
 */

/** Where the project has genuinely reached, judged only by what exists. */
export type ProductionStage =
  "script" | "scenes" | "storyboard" | "audio" | "render" | "release";

/**
 * Release state, kept separate from both stage and editorial status. These are
 * distinct on purpose: a rendered video is not a scheduled one, and a scheduled
 * one is not published.
 */
export type ReleaseState =
  "unpublished" | "scheduled" | "rendered" | "published";

export type ProductionBlockerKind =
  | "script_missing"
  | "script_unapproved"
  | "scenes_missing"
  | "images_failed"
  | "images_missing"
  | "audio_failed"
  | "audio_missing"
  | "render_failed"
  | "publication_failed";

export type ProductionReviewKind =
  "images_awaiting_review" | "audio_awaiting_review" | "scenes_awaiting_review";

/** A recovery pointer. `href` is a project-relative path segment. */
export interface ProductionAction {
  label: string;
  href: string;
}

export interface ProductionBlocker {
  kind: ProductionBlockerKind;
  /** Written for a creator, naming the count when a count is what matters. */
  message: string;
  /** Blocking work stops production; a warning needs attention but does not. */
  severity: "blocking" | "warning";
  action: ProductionAction;
}

export interface ProductionReview {
  kind: ProductionReviewKind;
  count: number;
  message: string;
  action: ProductionAction;
}

/**
 * Counts and flags read from the database. Every field is evidence of
 * something that happened; none of it is a status somebody typed.
 */
export interface ProjectProductionFacts {
  projectId: string;
  hasApprovedScript: boolean;
  hasScriptDraft: boolean;
  sceneCount: number;
  scenesAwaitingReview: number;
  imagesSucceeded: number;
  imagesAwaitingReview: number;
  imagesFailed: number;
  /** Scenes with no succeeded image yet, so a partial batch is measurable. */
  scenesWithoutApprovedImage: number;
  audioSucceeded: number;
  audioAwaitingReview: number;
  audioFailed: number;
  rendersSucceeded: number;
  rendersFailed: number;
  rendersInFlight: number;
  publicationsSucceeded: number;
  publicationsFailed: number;
  plannedReleaseAt: Date | null;
}

export interface ProductionReadiness {
  projectId: string;
  stage: ProductionStage;
  releaseState: ReleaseState;
  blockers: ProductionBlocker[];
  reviews: ProductionReview[];
  /** The single most useful next step, or null when nothing is outstanding. */
  nextAction: ProductionAction | null;
  /**
   * True only when a render succeeded and nothing failed anywhere. A partial
   * batch failure keeps this false, so no caller can render a success badge
   * over a project that lost scenes on the way.
   */
  isComplete: boolean;
}

const SCRIPT: ProductionAction = { label: "Open the script", href: "script" };
const SCENES: ProductionAction = { label: "Review the scenes", href: "scenes" };
const STORYBOARD: ProductionAction = {
  label: "Open the storyboard",
  href: "storyboard",
};
const AUDIO: ProductionAction = { label: "Open audio", href: "audio" };
const RENDER: ProductionAction = { label: "Open render", href: "render" };
const PUBLISH: ProductionAction = { label: "Open publish", href: "publish" };

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Release state, derived strictly in order of strongest evidence. */
function resolveReleaseState(facts: ProjectProductionFacts): ReleaseState {
  if (facts.publicationsSucceeded > 0) return "published";
  if (facts.rendersSucceeded > 0) return "rendered";
  if (facts.plannedReleaseAt !== null) return "scheduled";
  return "unpublished";
}

/**
 * The furthest stage the project has genuinely reached. Each step requires the
 * previous one to have produced something, so an empty project cannot appear
 * near the finish line.
 */
function resolveStage(facts: ProjectProductionFacts): ProductionStage {
  if (facts.publicationsSucceeded > 0) return "release";
  if (facts.rendersSucceeded > 0 || facts.rendersInFlight > 0) return "render";
  if (facts.audioSucceeded > 0) return "audio";
  if (facts.imagesSucceeded > 0) return "storyboard";
  if (facts.sceneCount > 0) return "scenes";
  return "script";
}

function collectBlockers(facts: ProjectProductionFacts): ProductionBlocker[] {
  const blockers: ProductionBlocker[] = [];

  if (!facts.hasApprovedScript)
    blockers.push({
      kind: facts.hasScriptDraft ? "script_unapproved" : "script_missing",
      message: facts.hasScriptDraft
        ? "The script draft is not approved yet."
        : "No script has been written yet.",
      severity: "blocking",
      action: SCRIPT,
    });
  else if (facts.sceneCount === 0)
    blockers.push({
      kind: "scenes_missing",
      message: "The approved script has not been analysed into scenes yet.",
      severity: "blocking",
      action: SCENES,
    });

  // Failures are reported before absences: a failed image is a different
  // problem from one that was never requested, and hiding it inside a generic
  // "images missing" count is exactly the partial-success trap.
  if (facts.imagesFailed > 0)
    blockers.push({
      kind: "images_failed",
      message: `${plural(facts.imagesFailed, "image", "images")} failed to generate.`,
      severity: "blocking",
      action: STORYBOARD,
    });
  else if (facts.sceneCount > 0 && facts.scenesWithoutApprovedImage > 0)
    blockers.push({
      kind: "images_missing",
      message: `${plural(facts.scenesWithoutApprovedImage, "scene has", "scenes have")} no image yet.`,
      severity: "warning",
      action: STORYBOARD,
    });

  if (facts.audioFailed > 0)
    blockers.push({
      kind: "audio_failed",
      message: `${plural(facts.audioFailed, "narration clip", "narration clips")} failed to generate.`,
      severity: "blocking",
      action: AUDIO,
    });
  else if (facts.sceneCount > 0 && facts.audioSucceeded === 0)
    blockers.push({
      kind: "audio_missing",
      message: "No narration audio has been generated yet.",
      severity: "warning",
      action: AUDIO,
    });

  if (facts.rendersFailed > 0 && facts.rendersSucceeded === 0)
    blockers.push({
      kind: "render_failed",
      message:
        facts.rendersFailed === 1
          ? "The render failed."
          : `${facts.rendersFailed} renders failed.`,
      severity: "blocking",
      action: RENDER,
    });

  if (facts.publicationsFailed > 0 && facts.publicationsSucceeded === 0)
    blockers.push({
      kind: "publication_failed",
      message: "Publishing failed.",
      severity: "blocking",
      action: PUBLISH,
    });

  return blockers;
}

function collectReviews(facts: ProjectProductionFacts): ProductionReview[] {
  const reviews: ProductionReview[] = [];
  if (facts.scenesAwaitingReview > 0)
    reviews.push({
      kind: "scenes_awaiting_review",
      count: facts.scenesAwaitingReview,
      message: `${plural(facts.scenesAwaitingReview, "scene", "scenes")} awaiting review`,
      action: SCENES,
    });
  if (facts.imagesAwaitingReview > 0)
    reviews.push({
      kind: "images_awaiting_review",
      count: facts.imagesAwaitingReview,
      message: `${plural(facts.imagesAwaitingReview, "image", "images")} awaiting review`,
      action: STORYBOARD,
    });
  if (facts.audioAwaitingReview > 0)
    reviews.push({
      kind: "audio_awaiting_review",
      count: facts.audioAwaitingReview,
      message: `${plural(facts.audioAwaitingReview, "narration clip", "narration clips")} awaiting review`,
      action: AUDIO,
    });
  return reviews;
}

/**
 * A blocking problem outranks a review, which outranks the next unstarted step,
 * so the queue always points at the thing that is actually holding the video up.
 */
function resolveNextAction(input: {
  facts: ProjectProductionFacts;
  blockers: ProductionBlocker[];
  reviews: ProductionReview[];
  releaseState: ReleaseState;
}): ProductionAction | null {
  const blocking = input.blockers.find(
    (entry) => entry.severity === "blocking",
  );
  if (blocking) return blocking.action;
  const review = input.reviews[0];
  if (review) return review.action;
  const warning = input.blockers[0];
  if (warning) return warning.action;
  if (input.releaseState === "published") return null;
  if (input.facts.rendersSucceeded > 0) return PUBLISH;
  if (input.facts.rendersInFlight > 0) return RENDER;
  if (input.facts.sceneCount > 0) return RENDER;
  return SCRIPT;
}

export function resolveProductionReadiness(
  facts: ProjectProductionFacts,
): ProductionReadiness {
  const releaseState = resolveReleaseState(facts);
  const blockers = collectBlockers(facts);
  const reviews = collectReviews(facts);
  return {
    projectId: facts.projectId,
    stage: resolveStage(facts),
    releaseState,
    blockers,
    reviews,
    nextAction: resolveNextAction({ facts, blockers, reviews, releaseState }),
    isComplete:
      facts.rendersSucceeded > 0 &&
      blockers.length === 0 &&
      reviews.length === 0,
  };
}
