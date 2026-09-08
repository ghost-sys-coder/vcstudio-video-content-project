"use client";

import { MicIcon, SquareIcon } from "lucide-react";
import type { ReactNode } from "react";
import { RecordingLevelMeter } from "@/components/audio/RecordingLevelMeter";
import { RecordingPlaybackPanel } from "@/components/audio/RecordingPlaybackPanel";
import { VoiceRequirementChecklist } from "@/components/audio/VoiceRequirementChecklist";
import { Button } from "@/components/ui/button";
import type { VoiceEnrollmentRecorderResult } from "@/lib/audio/use-voice-enrollment-recorder";
import {
  evaluateVoiceRecording,
  type VoiceRecordingSpec,
} from "@/lib/audio/voice-enrollment-requirements";

function formatClock(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function VoiceRecordingStepPanel({
  stepNumber,
  spec,
  instructions,
  recorder,
  disabled,
}: {
  stepNumber: number;
  spec: VoiceRecordingSpec;
  instructions: ReactNode;
  recorder: VoiceEnrollmentRecorderResult;
  disabled: boolean;
}) {
  const requirements = evaluateVoiceRecording(
    spec,
    recorder.recording?.capture ?? null,
  );
  const isRecording = recorder.state === "recording";
  const remainingMs = spec.maximumDurationMilliseconds - recorder.elapsedMs;

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">
          {stepNumber}. {spec.title}
        </h3>
        <div className="mt-1 text-sm text-muted-foreground">{instructions}</div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={disabled}
          onClick={isRecording ? recorder.stop : recorder.start}
          type="button"
          variant={isRecording ? "destructive" : "outline"}
        >
          {isRecording ? (
            <>
              <SquareIcon aria-hidden /> Stop recording
            </>
          ) : (
            <>
              <MicIcon aria-hidden />{" "}
              {recorder.recording ? "Record again" : "Start recording"}
            </>
          )}
        </Button>
        {isRecording ? (
          <p aria-live="polite" className="font-mono text-sm tabular-nums">
            {formatClock(recorder.elapsedMs)}
            {remainingMs <= 10_000 ? (
              <span className="ml-2 text-amber-600">
                {Math.max(0, Math.ceil(remainingMs / 1000))}s left
              </span>
            ) : null}
          </p>
        ) : null}
      </div>

      <RecordingLevelMeter active={isRecording} level={recorder.inputLevel} />

      {recorder.recording ? (
        <RecordingPlaybackPanel
          capture={recorder.recording.capture}
          label={spec.title}
          objectUrl={recorder.recording.objectUrl}
          onDiscard={recorder.reset}
          onReRecord={() => void recorder.start()}
        />
      ) : null}

      {recorder.error ? (
        <p className="text-sm text-destructive" role="alert">
          {recorder.error}
        </p>
      ) : null}

      <VoiceRequirementChecklist requirements={requirements} />
    </section>
  );
}
