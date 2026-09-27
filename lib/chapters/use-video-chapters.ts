"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cancelVideoChaptersAction,
  generateVideoChaptersAction,
  loadChaptersViewAction,
  saveVideoChaptersAction,
} from "@/app/(authenticated)/app/projects/[projectId]/publish/actions";
import type { ChaptersView } from "@/lib/chapters/chapters-view";
import {
  findChaptersOffSceneStarts,
  formatChapterBlock,
  validateChapters,
  type ChapterIssue,
  type VideoChapter,
} from "@/lib/chapters/youtube-chapters";

const POLL_INTERVAL_MILLISECONDS = 2_500;
const MAX_POLLS = 60;

function isActive(status: string | undefined): boolean {
  return status === "pending" || status === "queued" || status === "running";
}

function byStart(left: VideoChapter, right: VideoChapter): number {
  return left.startMilliseconds - right.startMilliseconds;
}

interface Draft {
  /** Which saved state this draft was started from: render and version. */
  baseKey: string;
  chapters: VideoChapter[];
  includeInYouTubeDescription: boolean;
  dirty: boolean;
}

function draftFrom(view: ChaptersView): Draft {
  const selected = view.selected;
  return {
    baseKey: `${selected?.renderId ?? "none"}:${selected?.saved?.version ?? 0}`,
    chapters: selected?.saved?.chapters ?? [],
    includeInYouTubeDescription:
      selected?.saved?.includeInYouTubeDescription ?? true,
    dirty: false,
  };
}

/**
 * State and actions for the video chapters panel.
 *
 * The draft is reset whenever the saved chapters change underneath it — a
 * different render, or a generation that finished — unless the person has
 * unsaved edits, which are kept; the server then refuses a stale save with a
 * message rather than overwriting the newer chapters.
 */
export function useVideoChapters(input: {
  projectId: string;
  initialData: ChaptersView;
}) {
  const { projectId } = input;
  const [view, setView] = useState<ChaptersView>(input.initialData);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(input.initialData));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pollingRef = useRef(false);

  const selected = view.selected;
  const loadedKey = `${selected?.renderId ?? "none"}:${selected?.saved?.version ?? 0}`;
  if (loadedKey !== draft.baseKey && !draft.dirty) setDraft(draftFrom(view));

  const run = selected?.latestRun ?? null;
  const generating = isActive(run?.status);
  const cancellable = run?.status === "pending" || run?.status === "queued";
  const duration = selected?.videoDurationMilliseconds ?? 0;

  const issues: ChapterIssue[] = useMemo(
    () =>
      draft.chapters.length === 0
        ? []
        : validateChapters(draft.chapters, duration),
    [draft.chapters, duration],
  );
  const offSceneIndexes = useMemo(
    () =>
      findChaptersOffSceneStarts(draft.chapters, selected?.sceneStarts ?? []),
    [draft.chapters, selected?.sceneStarts],
  );
  const preview = useMemo(
    () =>
      draft.chapters.length === 0
        ? ""
        : formatChapterBlock(draft.chapters, duration),
    [draft.chapters, duration],
  );

  const refresh = useCallback(
    async (renderId: string | null) => {
      const next = await loadChaptersViewAction(projectId, renderId);
      if (next) setView(next);
      return next;
    },
    [projectId],
  );

  const renderId = selected?.renderId ?? null;
  const poll = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    try {
      for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
        await new Promise((resolve) =>
          setTimeout(resolve, POLL_INTERVAL_MILLISECONDS),
        );
        const next = await refresh(renderId);
        if (!isActive(next?.selected?.latestRun?.status)) return;
      }
    } finally {
      pollingRef.current = false;
    }
  }, [refresh, renderId]);

  useEffect(() => {
    if (generating) void poll();
  }, [generating, poll]);

  function edit(update: (chapters: VideoChapter[]) => VideoChapter[]) {
    setNotice(null);
    setDraft((previous) => ({
      ...previous,
      chapters: update(previous.chapters),
      dirty: true,
    }));
  }

  async function selectRender(nextRenderId: string) {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const next = await refresh(nextRenderId);
      if (next) setDraft(draftFrom(next));
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("renderId", selected.renderId);
      formData.set("requestNonce", crypto.randomUUID());
      const result = await generateVideoChaptersAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      // A new generation replaces the chapters, so unsaved edits give way.
      setDraft((previous) => ({ ...previous, dirty: false }));
      await refresh(selected.renderId);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!run || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("chapterGenerationRunId", run.id);
      const result = await cancelVideoChaptersAction(formData);
      if (!result.success) setError(result.error);
      await refresh(selected.renderId);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("renderId", selected.renderId);
      formData.set("chapters", JSON.stringify(draft.chapters));
      formData.set(
        "includeInYouTubeDescription",
        String(draft.includeInYouTubeDescription),
      );
      formData.set("expectedVersion", String(selected.saved?.version ?? 0));
      const result = await saveVideoChaptersAction(formData);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setDraft((previous) => ({ ...previous, dirty: false }));
      await refresh(selected.renderId);
      setNotice("Chapters saved.");
    } finally {
      setBusy(false);
    }
  }

  function addChapter() {
    const starts = selected?.sceneStarts ?? [];
    edit((chapters) => {
      const used = new Set(
        chapters.map((chapter) => chapter.startMilliseconds),
      );
      const last = chapters.at(-1)?.startMilliseconds ?? -1;
      const next =
        starts.find(
          (scene) =>
            scene.startMilliseconds > last &&
            !used.has(scene.startMilliseconds),
        ) ?? starts.find((scene) => !used.has(scene.startMilliseconds));
      if (!next) return chapters;
      return [
        ...chapters,
        { startMilliseconds: next.startMilliseconds, title: "" },
      ].sort(byStart);
    });
  }

  return {
    view,
    selected,
    draft,
    issues,
    offSceneIndexes,
    preview,
    busy,
    error,
    notice,
    generating,
    cancellable,
    selectRender,
    generate,
    cancel,
    save,
    addChapter,
    setTitle: (index: number, title: string) =>
      edit((chapters) =>
        chapters.map((chapter, position) =>
          position === index ? { ...chapter, title } : chapter,
        ),
      ),
    setStart: (index: number, startMilliseconds: number) =>
      edit((chapters) =>
        chapters
          .map((chapter, position) =>
            position === index ? { ...chapter, startMilliseconds } : chapter,
          )
          .sort(byStart),
      ),
    removeChapter: (index: number) =>
      edit((chapters) => chapters.filter((_, position) => position !== index)),
    setIncludeInYouTubeDescription: (include: boolean) => {
      setNotice(null);
      setDraft((previous) => ({
        ...previous,
        includeInYouTubeDescription: include,
        dirty: true,
      }));
    },
  };
}
