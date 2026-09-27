"use client";

import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatChapterTimestamp,
  YOUTUBE_CHAPTER_RULES,
  type ChapterSceneTiming,
  type VideoChapter,
} from "@/lib/chapters/youtube-chapters";

/**
 * One chapter: where it starts and what it is called.
 *
 * The start is chosen from the render's scene starts rather than typed, so a
 * chapter can only ever begin on a real cut in the uploaded video.
 */
export function ChapterEditorRow({
  index,
  chapter,
  sceneStarts,
  videoDurationMilliseconds,
  messages,
  disabled,
  onStartChange,
  onTitleChange,
  onRemove,
}: {
  index: number;
  chapter: VideoChapter;
  sceneStarts: ChapterSceneTiming[];
  videoDurationMilliseconds: number;
  messages: string[];
  disabled: boolean;
  onStartChange: (startMilliseconds: number) => void;
  onTitleChange: (title: string) => void;
  onRemove: () => void;
}) {
  const startId = `chapter-start-${index}`;
  const titleId = `chapter-title-${index}`;
  const messageId = `chapter-issue-${index}`;
  const items = Object.fromEntries(
    sceneStarts.map((scene) => [
      String(scene.startMilliseconds),
      `${formatChapterTimestamp(scene.startMilliseconds, videoDurationMilliseconds)} · scene ${scene.sceneNumber}`,
    ]),
  );

  return (
    <li className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor={startId}>
          Chapter {index + 1} start
        </label>
        <Select
          disabled={disabled}
          items={items}
          onValueChange={(value) => onStartChange(Number(value))}
          value={String(chapter.startMilliseconds)}
        >
          <SelectTrigger
            aria-describedby={messages.length > 0 ? messageId : undefined}
            className="w-52 shrink-0 font-mono tabular-nums"
            id={startId}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sceneStarts.map((scene) => (
              <SelectItem
                key={scene.sceneNumber}
                value={String(scene.startMilliseconds)}
              >
                {items[String(scene.startMilliseconds)]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="sr-only" htmlFor={titleId}>
          Chapter {index + 1} title
        </label>
        <Input
          aria-describedby={messages.length > 0 ? messageId : undefined}
          aria-invalid={messages.length > 0}
          className="min-w-48 flex-1"
          disabled={disabled}
          id={titleId}
          maxLength={YOUTUBE_CHAPTER_RULES.maximumTitleLength}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Chapter title"
          value={chapter.title}
        />
        <Button
          aria-label={`Remove chapter ${index + 1}`}
          disabled={disabled}
          onClick={onRemove}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Trash2Icon aria-hidden />
        </Button>
      </div>
      {messages.length > 0 ? (
        <p className="text-xs text-destructive" id={messageId}>
          {messages.join(" ")}
        </p>
      ) : null}
    </li>
  );
}
