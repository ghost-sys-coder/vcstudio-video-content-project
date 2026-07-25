"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CircleIcon, MicIcon, SquareIcon } from "lucide-react";
import { AudioDurationDisplay } from "@/components/audio/AudioDurationDisplay";
import { SceneAudioPlayer } from "@/components/audio/SceneAudioPlayer";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSceneAudioRecorder } from "@/lib/audio/use-scene-audio-recorder";
import type { AudioSceneView } from "@/lib/audio/audio-view";
import { uploadSceneAudioRecording } from "@/lib/storage/upload-scene-audio.client";
import { cn } from "@/lib/utils";

export function SceneAudioRecordDialog({
  projectId,
  scene,
  disabled,
  onRecorded,
}: {
  projectId: string;
  scene: AudioSceneView;
  disabled: boolean;
  onRecorded: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const recorder = useSceneAudioRecorder();

  const previewUrl = useMemo(
    () => (recorder.blob ? URL.createObjectURL(recorder.blob) : null),
    [recorder.blob],
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const close = () => {
    setOpen(false);
    setSaveError(null);
    recorder.reset();
  };

  return (
    <>
      <Button
        disabled={disabled}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        <MicIcon aria-hidden />
        Record
      </Button>
      <Dialog
        onOpenChange={(next) => (next ? setOpen(true) : close())}
        open={open}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Record scene {scene.sceneNumber} narration
            </DialogTitle>
            <DialogDescription>
              Read the text below while recording. You can listen back and
              compare with the existing narration before saving.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-40 overflow-y-auto rounded-lg bg-muted/40 p-3 text-sm">
            {scene.narrationText || "No narration text for this scene."}
          </div>

          <div className="flex items-center gap-3 rounded-lg border p-3">
            {recorder.state === "recording" ? (
              <Button
                onClick={() => recorder.stop()}
                size="sm"
                type="button"
                variant="destructive"
              >
                <SquareIcon aria-hidden />
                Stop
              </Button>
            ) : (
              <Button
                disabled={pending}
                onClick={() => recorder.start()}
                size="sm"
                type="button"
              >
                <CircleIcon aria-hidden />
                {recorder.blob ? "Record again" : "Start recording"}
              </Button>
            )}
            <span
              className={cn(
                "font-mono text-xs tabular-nums text-muted-foreground",
                recorder.state === "recording" && "text-destructive",
              )}
            >
              {(recorder.state === "recording"
                ? recorder.elapsedMs / 1000
                : (recorder.durationMs ?? 0) / 1000
              ).toFixed(1)}
              s
            </span>
            {recorder.error ? (
              <span className="text-xs text-destructive" role="alert">
                {recorder.error}
              </span>
            ) : null}
          </div>

          {previewUrl || scene.audioUrl ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {scene.audioUrl ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Current narration
                  </p>
                  <SceneAudioPlayer
                    label={`Scene ${scene.sceneNumber} current narration`}
                    src={scene.audioUrl}
                  />
                  <AudioDurationDisplay
                    durationMilliseconds={scene.durationMilliseconds}
                  />
                </div>
              ) : null}
              {previewUrl ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Your recording
                  </p>
                  <SceneAudioPlayer
                    label={`Scene ${scene.sceneNumber} new recording`}
                    src={previewUrl}
                  />
                  <AudioDurationDisplay
                    durationMilliseconds={recorder.durationMs}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {saveError ? (
            <p className="text-xs text-destructive" role="alert">
              {saveError}
            </p>
          ) : null}

          <DialogFooter>
            <DialogClose onClick={close} render={<Button variant="outline" />}>
              Discard
            </DialogClose>
            <Button
              disabled={
                pending || !recorder.blob || recorder.state === "recording"
              }
              onClick={() => {
                const blob = recorder.blob;
                if (!blob) return;
                startTransition(async () => {
                  try {
                    await uploadSceneAudioRecording({
                      projectId,
                      sceneId: scene.sceneId,
                      sceneVersionId: scene.sceneVersionId,
                      blob,
                      contentType:
                        blob.type === "audio/mp4" ? "audio/mp4" : "audio/webm",
                      durationMilliseconds: recorder.durationMs ?? 0,
                    });
                    close();
                    await onRecorded();
                  } catch (uploadError) {
                    setSaveError(
                      uploadError instanceof Error
                        ? uploadError.message
                        : "The recording could not be saved.",
                    );
                  }
                });
              }}
              type="button"
            >
              {pending ? "Saving…" : "Save recording"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
