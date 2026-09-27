/**
 * YouTube chapters: the rules, the timestamps, and the description block.
 *
 * YouTube has no chapters API. It reads timestamps written in a video's
 * description and, when every rule below holds, turns them into chapters. When
 * any rule fails it shows none — silently. So the rules are enforced here, on
 * our side, where a failure can be shown to the person before publishing.
 *
 * Times come from the render's frozen timeline, never from a model: a chapter
 * may only start where a scene starts, so a timestamp always lands on a real
 * cut in the uploaded video. Dependency-free, so the editor can validate as the
 * person types and the server can re-check the same way at publish.
 */

export const YOUTUBE_CHAPTER_RULES = {
  minimumChapters: 3,
  minimumChapterSeconds: 10,
  maximumTitleLength: 100,
  /** YouTube's description limit, which the chapter block must fit inside. */
  maximumDescriptionLength: 5_000,
} as const;

export interface VideoChapter {
  startMilliseconds: number;
  title: string;
}

/** A scene as the render placed it, which is all chapters are built from. */
export interface ChapterSceneTiming {
  sceneNumber: number;
  startMilliseconds: number;
}

export interface ChapterIssue {
  /** The chapter the issue belongs to, or null for the list as a whole. */
  index: number | null;
  message: string;
}

/** YouTube reads whole seconds; so must every rule that compares durations. */
function wholeSeconds(milliseconds: number): number {
  return Math.floor(milliseconds / 1_000);
}

/**
 * `0:00`, `4:05`, or `1:02:03` once the video runs an hour or more. Hours are
 * decided by the video's length rather than each timestamp, so every line of
 * the block has the same shape.
 */
export function formatChapterTimestamp(
  startMilliseconds: number,
  videoDurationMilliseconds: number,
): string {
  const total = wholeSeconds(Math.max(0, startMilliseconds));
  const hours = Math.floor(total / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const seconds = total % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");
  if (wholeSeconds(videoDurationMilliseconds) >= 3_600)
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  return `${minutes + hours * 60}:${paddedSeconds}`;
}

/** Collapses whitespace and strips a leading timestamp or list number. */
export function cleanChapterTitle(title: string): string {
  return title
    .replace(/\s+/g, " ")
    .replace(/^\s*(?:\d{1,2}:)?\d{1,2}:\d{2}\s*[-–—:|]?\s*/, "")
    .replace(/^\s*\d{1,2}[.)]\s+/, "")
    .trim()
    .slice(0, YOUTUBE_CHAPTER_RULES.maximumTitleLength);
}

/**
 * Every reason YouTube would ignore these chapters. Empty means YouTube will
 * show them.
 */
export function validateChapters(
  chapters: readonly VideoChapter[],
  videoDurationMilliseconds: number,
): ChapterIssue[] {
  const issues: ChapterIssue[] = [];
  const { minimumChapters, minimumChapterSeconds, maximumTitleLength } =
    YOUTUBE_CHAPTER_RULES;

  if (chapters.length < minimumChapters)
    issues.push({
      index: null,
      message: `YouTube needs at least ${minimumChapters} chapters.`,
    });
  const first = chapters[0];
  if (first && wholeSeconds(first.startMilliseconds) !== 0)
    issues.push({
      index: 0,
      message: "The first chapter must start at 0:00.",
    });

  chapters.forEach((chapter, index) => {
    const title = chapter.title.trim();
    if (title === "")
      issues.push({ index, message: "Give this chapter a title." });
    else if (title.length > maximumTitleLength)
      issues.push({
        index,
        message: `Keep the title under ${maximumTitleLength} characters.`,
      });
    if (/[\r\n]/.test(chapter.title))
      issues.push({ index, message: "A title must fit on one line." });

    const start = wholeSeconds(chapter.startMilliseconds);
    if (
      !Number.isFinite(chapter.startMilliseconds) ||
      chapter.startMilliseconds < 0 ||
      start >= wholeSeconds(videoDurationMilliseconds)
    ) {
      issues.push({ index, message: "This chapter starts outside the video." });
      return;
    }
    const previous = chapters[index - 1];
    if (previous && start <= wholeSeconds(previous.startMilliseconds))
      issues.push({
        index,
        message: "Chapters must be in order, each starting after the last.",
      });

    const nextStart = chapters[index + 1]?.startMilliseconds;
    const end = wholeSeconds(nextStart ?? videoDurationMilliseconds);
    if (end - start < minimumChapterSeconds)
      issues.push({
        index,
        message: `Each chapter must last at least ${minimumChapterSeconds} seconds; this one lasts ${Math.max(0, end - start)}.`,
      });
  });

  return issues;
}

export function formatChapterBlock(
  chapters: readonly VideoChapter[],
  videoDurationMilliseconds: number,
): string {
  return chapters
    .map(
      (chapter) =>
        `${formatChapterTimestamp(chapter.startMilliseconds, videoDurationMilliseconds)} ${cleanChapterTitle(chapter.title)}`,
    )
    .join("\n");
}

/** A line that already reads as a YouTube chapter, e.g. `0:00 Intro`. */
const EXISTING_CHAPTER_LINE = /^\s*(?:0:)?0?0:00\s+\S/m;

export type ChapterDescriptionResult =
  | { applied: true; description: string }
  | {
      applied: false;
      description: string;
      reason: "already_present" | "too_long";
    };

/**
 * Adds the chapter block to the end of a description.
 *
 * Nothing is truncated to make room: cutting the person's copy or the chapter
 * block would publish something neither of them wrote, so an overlong result
 * is refused and reported instead. A description that already carries its own
 * chapters is left as it is, rather than given a second, competing set.
 */
export function appendChaptersToDescription(
  description: string,
  chapterBlock: string,
): ChapterDescriptionResult {
  if (EXISTING_CHAPTER_LINE.test(description))
    return { applied: false, description, reason: "already_present" };
  const body = description.trimEnd();
  const combined = body === "" ? chapterBlock : `${body}\n\n${chapterBlock}`;
  if (combined.length > YOUTUBE_CHAPTER_RULES.maximumDescriptionLength)
    return { applied: false, description, reason: "too_long" };
  return { applied: true, description: combined };
}

/**
 * Turns a model's picks — "a chapter starts at scene N, called X" — into
 * chapters YouTube will accept.
 *
 * The model chooses where the story turns and what to call it; it never
 * chooses a time. Each pick is placed at its scene's rendered start, the
 * first chapter is pinned to 0:00, duplicates and unknown scenes are dropped,
 * and a chapter too short to count is folded into the one before it, which is
 * the least surprising repair.
 */
export function buildChaptersFromScenePicks(input: {
  picks: readonly { startSceneNumber: number; title: string }[];
  scenes: readonly ChapterSceneTiming[];
  videoDurationMilliseconds: number;
}): VideoChapter[] {
  const startByScene = new Map(
    input.scenes.map((scene) => [scene.sceneNumber, scene.startMilliseconds]),
  );
  const placed = input.picks
    .map((pick) => ({
      startMilliseconds: startByScene.get(pick.startSceneNumber),
      title: cleanChapterTitle(pick.title),
    }))
    .filter(
      (pick): pick is VideoChapter =>
        pick.startMilliseconds !== undefined && pick.title !== "",
    )
    .sort((left, right) => left.startMilliseconds - right.startMilliseconds);

  const chapters: VideoChapter[] = [];
  for (const chapter of placed) {
    const last = chapters.at(-1);
    if (
      last &&
      wholeSeconds(chapter.startMilliseconds) <=
        wholeSeconds(last.startMilliseconds)
    )
      continue;
    chapters.push(chapter);
  }
  if (chapters[0]) chapters[0] = { ...chapters[0], startMilliseconds: 0 };

  // Fold short chapters forward-to-back until every one is long enough.
  const minimum = YOUTUBE_CHAPTER_RULES.minimumChapterSeconds;
  let index = 1;
  while (index < chapters.length) {
    const current = chapters[index];
    const previous = chapters[index - 1];
    if (!current || !previous) break;
    const previousLength =
      wholeSeconds(current.startMilliseconds) -
      wholeSeconds(previous.startMilliseconds);
    if (previousLength < minimum) {
      // The earlier chapter is too short: it absorbs this one's start.
      chapters.splice(index, 1);
      continue;
    }
    index += 1;
  }
  const last = chapters.at(-1);
  if (
    chapters.length > 1 &&
    last &&
    wholeSeconds(input.videoDurationMilliseconds) -
      wholeSeconds(last.startMilliseconds) <
      minimum
  )
    chapters.pop();

  return chapters;
}

/**
 * How many chapters to ask for: roughly one per minute and a quarter, never
 * fewer than YouTube's minimum and never so many that the list stops helping.
 */
export function targetChapterRange(videoDurationMilliseconds: number): {
  minimum: number;
  maximum: number;
} {
  const minutes = videoDurationMilliseconds / 60_000;
  const maximum = Math.min(
    15,
    Math.max(
      YOUTUBE_CHAPTER_RULES.minimumChapters,
      Math.floor(videoDurationMilliseconds / 45_000),
    ),
  );
  const minimum = Math.min(
    maximum,
    Math.max(YOUTUBE_CHAPTER_RULES.minimumChapters, Math.round(minutes / 1.5)),
  );
  return { minimum, maximum };
}

/** Too short for three ten-second chapters means no chapters at all. */
export function canHaveChapters(videoDurationMilliseconds: number): boolean {
  return (
    wholeSeconds(videoDurationMilliseconds) >=
    YOUTUBE_CHAPTER_RULES.minimumChapters *
      YOUTUBE_CHAPTER_RULES.minimumChapterSeconds
  );
}

/** YouTube does not show chapters on Shorts, which are vertical. */
export function isShortsShaped(dimensions: {
  width: number;
  height: number;
}): boolean {
  return dimensions.height > dimensions.width;
}

export type PublishDescriptionResult =
  | { ok: true; description: string; chaptersAdded: boolean }
  | { ok: false; error: string };

/**
 * The description a YouTube upload goes out with, given the render's saved
 * chapters and the person's choice to include them.
 *
 * Refuses rather than quietly publishing without chapters the person asked
 * for: broken rules or a description too long to hold them are reported so
 * they can be fixed, because YouTube itself would drop them without a word.
 */
export function resolvePublishDescription(input: {
  description: string;
  chapters: readonly VideoChapter[] | null;
  includeInYouTubeDescription: boolean;
  videoDurationMilliseconds: number;
  dimensions: { width: number; height: number };
}): PublishDescriptionResult {
  const unchanged = {
    ok: true as const,
    description: input.description,
    chaptersAdded: false,
  };
  if (
    !input.chapters ||
    input.chapters.length === 0 ||
    !input.includeInYouTubeDescription ||
    isShortsShaped(input.dimensions)
  )
    return unchanged;

  const issues = validateChapters(
    input.chapters,
    input.videoDurationMilliseconds,
  );
  if (issues.length > 0)
    return {
      ok: false,
      error: `The chapters saved for this render break YouTube's rules: ${issues[0]?.message ?? ""} Fix them under Video chapters, or turn off "Add to YouTube description".`,
    };
  const result = appendChaptersToDescription(
    input.description,
    formatChapterBlock(input.chapters, input.videoDurationMilliseconds),
  );
  if (result.applied)
    return { ok: true, description: result.description, chaptersAdded: true };
  if (result.reason === "already_present") return unchanged;
  return {
    ok: false,
    error: `The description and chapters together exceed YouTube's ${YOUTUBE_CHAPTER_RULES.maximumDescriptionLength.toLocaleString("en-US")}-character limit. Shorten the description, or turn off "Add to YouTube description".`,
  };
}

/**
 * Chapters a person edited may only start where a scene starts, or at 0:00.
 * Anything else would point viewers at a moment that is not a cut in the
 * uploaded video — and would be a time the browser made up.
 */
export function findChaptersOffSceneStarts(
  chapters: readonly VideoChapter[],
  scenes: readonly ChapterSceneTiming[],
): number[] {
  const starts = new Set(scenes.map((scene) => scene.startMilliseconds));
  starts.add(0);
  return chapters.flatMap((chapter, index) =>
    starts.has(chapter.startMilliseconds) ? [] : [index],
  );
}
