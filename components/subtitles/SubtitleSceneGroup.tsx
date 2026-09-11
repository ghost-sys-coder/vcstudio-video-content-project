"use client";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { SubtitleSegmentRow } from "@/components/subtitles/SubtitleSegmentRow";
import { SceneCueTimingEditor } from "@/components/subtitles/SceneCueTimingEditor";
import type { SubtitleSegmentGroup } from "@/lib/subtitles/subtitle-segment-groups";
import type {
  SaveSubtitleSegmentHandler,
  SubtitleSceneSummaryView,
} from "@/lib/subtitles/subtitle-view";

export function SubtitleSceneGroup({
  group,
  scene,
  projectId,
  canManage,
  minimumCueDurationMilliseconds,
  onSave,
  onCuesSaved,
}: {
  group: SubtitleSegmentGroup;
  scene: SubtitleSceneSummaryView | undefined;
  projectId: string;
  canManage: boolean;
  minimumCueDurationMilliseconds: number;
  onSave: SaveSubtitleSegmentHandler;
  onCuesSaved: () => void;
}) {
  const cueCount = group.segments.length;

  return (
    <AccordionItem value={group.sceneId}>
      <AccordionTrigger className="px-1">
        <span className="flex flex-1 flex-wrap items-center gap-2">
          <span className="font-semibold">Scene {group.sceneNumber}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {cueCount} cue{cueCount === 1 ? "" : "s"}
          </span>
          {group.editedCount > 0 ? (
            <Badge variant="secondary">{group.editedCount} edited</Badge>
          ) : null}
          {group.longCount > 0 ? (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {group.longCount} long
            </Badge>
          ) : null}
        </span>
      </AccordionTrigger>
      <AccordionContent className="px-1">
        <div className="space-y-2">
          {group.segments.map((segment) => (
            <SubtitleSegmentRow
              canManage={canManage}
              key={segment.key}
              onSave={onSave}
              segment={segment}
            />
          ))}
          {scene ? (
            <div className="mt-3 border-t pt-3">
              <SceneCueTimingEditor
                canManage={canManage}
                minimumCueDurationMilliseconds={minimumCueDurationMilliseconds}
                onSaved={onCuesSaved}
                projectId={projectId}
                scene={scene}
                segments={group.segments}
              />
            </div>
          ) : null}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}
