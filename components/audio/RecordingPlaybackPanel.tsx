"use client";

import { RotateCcwIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { VoiceRecordingCapture } from "@/lib/audio/voice-enrollment-requirements";

function formatClock(milliseconds: number): string {
  const totalSeconds = Math.round(milliseconds / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

/**
 * Proof that a recording exists: it names the clip, states its measured length
 * and size, and plays it back from the in-browser blob. Without this the only
 * signal a recording was captured was a line of text, which is exactly what
 * made a working recording look like a missing one.
 */
export function RecordingPlaybackPanel({
  capture,
  label,
  objectUrl,
  onDiscard,
  onReRecord,
}: {
  capture: VoiceRecordingCapture;
  label: string;
  objectUrl: string;
  onDiscard: () => void;
  onReRecord: () => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-emerald-600/30 bg-emerald-50/50 p-3 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {label} recorded · {formatClock(capture.durationMilliseconds)} ·{" "}
          {(capture.sizeBytes / 1024).toFixed(0)} KB
        </p>
        <div className="flex gap-2">
          <Button
            onClick={onReRecord}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcwIcon aria-hidden /> Re-record
          </Button>
          <Button onClick={onDiscard} size="sm" type="button" variant="ghost">
            <Trash2Icon aria-hidden />
            <span className="sr-only">Discard {label}</span>
          </Button>
        </div>
      </div>
      <audio
        aria-label={`Play back the ${label.toLowerCase()}`}
        className="h-9 w-full"
        controls
        preload="metadata"
        src={objectUrl}
      >
        Your browser does not support audio playback.
      </audio>
    </div>
  );
}
