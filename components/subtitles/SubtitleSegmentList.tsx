"use client";

import { useMemo, useState } from "react";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { SubtitleSceneGroup } from "@/components/subtitles/SubtitleSceneGroup";
import { groupSegmentsByScene } from "@/lib/subtitles/subtitle-segment-groups";
import type {
  SaveSubtitleSegmentHandler,
  SubtitleSegmentView,
} from "@/lib/subtitles/subtitle-view";

export function SubtitleSegmentList({
  segments,
  canManage,
  onSave,
}: {
  segments: SubtitleSegmentView[];
  canManage: boolean;
  onSave: SaveSubtitleSegmentHandler;
}) {
  const groups = useMemo(() => groupSegmentsByScene(segments), [segments]);
  const signature = groups.map((group) => group.sceneId).join("|");

  // The first scene starts expanded so the panel is not empty on load. When the
  // set of scenes changes (granularity switch or track rebuild) the open state
  // is reset via the "adjust state during render" pattern to avoid an effect.
  const [openSignature, setOpenSignature] = useState(signature);
  const [openScenes, setOpenScenes] = useState<string[]>(() =>
    groups.length > 0 ? [groups[0]!.sceneId] : [],
  );
  if (signature !== openSignature) {
    setOpenSignature(signature);
    setOpenScenes(groups.length > 0 ? [groups[0]!.sceneId] : []);
  }

  const allExpanded = openScenes.length === groups.length && groups.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button
          onClick={() =>
            setOpenScenes(
              allExpanded ? [] : groups.map((group) => group.sceneId),
            )
          }
          size="sm"
          type="button"
          variant="ghost"
        >
          {allExpanded ? "Collapse all" : "Expand all"}
        </Button>
      </div>
      <Accordion
        onValueChange={(value) => setOpenScenes(value as string[])}
        value={openScenes}
      >
        {groups.map((group) => (
          <SubtitleSceneGroup
            canManage={canManage}
            group={group}
            key={group.sceneId}
            onSave={onSave}
          />
        ))}
      </Accordion>
    </div>
  );
}
