"use client";

import { useCallback, useRef, useState } from "react";
import {
  updateSubtitleSegmentAction,
  updateSubtitleSettingsAction,
} from "@/app/(authenticated)/app/projects/[projectId]/subtitles/actions";
import { BuildTimelineButton } from "@/components/subtitles/BuildTimelineButton";
import { CaptionStyleForm } from "@/components/subtitles/CaptionStyleForm";
import { ExportSubtitleButton } from "@/components/subtitles/ExportSubtitleButton";
import { SubtitleEditor } from "@/components/subtitles/SubtitleEditor";
import { SubtitlePreview } from "@/components/subtitles/SubtitlePreview";
import { SubtitleTrackSelector } from "@/components/subtitles/SubtitleTrackSelector";
import { TimelineValidationPanel } from "@/components/subtitles/TimelineValidationPanel";
import type { CaptionStyleData } from "@/lib/subtitles/caption-style-data";
import type {
  SubtitleActionResult,
  SubtitleWorkspaceView,
} from "@/lib/subtitles/subtitle-view";
import { subtitleWorkspaceResponseSchema } from "@/lib/schemas/subtitle-response";

export function SubtitleWorkspace({
  projectId,
  initialData,
  canManage,
}: {
  projectId: string;
  initialData: SubtitleWorkspaceView;
  canManage: boolean;
}) {
  const [data, setData] = useState<SubtitleWorkspaceView>(initialData);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const response = await fetch(`/api/projects/${projectId}/subtitles`, {
        cache: "no-store",
      });
      const payload: unknown = await response.json();
      const parsed = subtitleWorkspaceResponseSchema.safeParse(payload);
      if (response.ok && parsed.success && parsed.data.success)
        setData(parsed.data.data);
    } finally {
      refreshing.current = false;
    }
  }, [projectId]);

  const saveSettings = useCallback(
    async (input: {
      granularity: SubtitleWorkspaceView["granularity"];
      captionStyle: CaptionStyleData;
    }): Promise<SubtitleActionResult> => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("granularity", input.granularity);
      formData.set("captionStyle", JSON.stringify(input.captionStyle));
      const result = await updateSubtitleSettingsAction(formData);
      if (result.success) await refresh();
      return result;
    },
    [projectId, refresh],
  );

  const changeGranularity = useCallback(
    async (granularity: SubtitleWorkspaceView["granularity"]) => {
      await saveSettings({ granularity, captionStyle: data.captionStyle });
    },
    [data.captionStyle, saveSettings],
  );

  const saveStyle = useCallback(
    (style: CaptionStyleData) =>
      saveSettings({ granularity: data.granularity, captionStyle: style }),
    [data.granularity, saveSettings],
  );

  const saveSegment = useCallback(
    async (input: {
      segmentKey: string;
      text: string;
    }): Promise<SubtitleActionResult> => {
      const formData = new FormData();
      formData.set("projectId", projectId);
      formData.set("segmentKey", input.segmentKey);
      formData.set("text", input.text);
      const result = await updateSubtitleSegmentAction(formData);
      if (result.success) await refresh();
      return result;
    },
    [projectId, refresh],
  );

  const previewText = data.segments[0]?.text ?? "";

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-dashed bg-muted/30 p-4">
        <h2 className="text-sm font-semibold">Subtitles &amp; timeline</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Captions are derived automatically from each scene&rsquo;s approved
          narration audio — sentence or scene timing is distributed across the
          measured audio duration, never guessed word by word. Choose a caption
          track, restyle the captions, fix any wording, then export SRT/WebVTT
          or confirm the timeline is ready for rendering.
        </p>
      </section>

      <TimelineValidationPanel timeline={data.timeline} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <SubtitleTrackSelector
            disabled={!canManage}
            granularity={data.granularity}
            onChange={changeGranularity}
          />
          <BuildTimelineButton
            errorCount={data.timeline.errorCount}
            onBuild={refresh}
            status={data.timeline.status}
          />
        </div>
        <div className="flex items-center gap-2">
          <ExportSubtitleButton
            disabled={!data.hasSubtitles}
            format="srt"
            projectId={projectId}
          />
          <ExportSubtitleButton
            disabled={!data.hasSubtitles}
            format="vtt"
            projectId={projectId}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <SubtitlePreview
            captionStyle={data.captionStyle}
            sampleText={previewText}
          />
          <CaptionStyleForm
            canManage={canManage}
            captionStyle={data.captionStyle}
            key={`${data.captionStyle.fontFamily}-${data.captionStyle.position}-${data.captionStyle.maxLineCharacters}`}
            onSave={saveStyle}
          />
        </div>
        <SubtitleEditor
          canManage={canManage}
          onSave={saveSegment}
          segments={data.segments}
        />
      </div>
    </div>
  );
}
