"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSceneAudioRecorder } from "@/lib/audio/use-scene-audio-recorder";
import { CUSTOM_VOICE_CONSENT_PHRASE } from "@/lib/schemas/scene-audio";

function recordingFileName(prefix: string, mimeType: string): string {
  return `${prefix}.${mimeType.toLowerCase().startsWith("audio/mp4") ? "m4a" : "webm"}`;
}

export function CustomVoiceEnrollmentDialog({
  open,
  onOpenChange,
  projectId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onCreated: () => Promise<void>;
}) {
  const consent = useSceneAudioRecorder();
  const sample = useSceneAudioRecorder();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!consent.blob || !sample.blob || !name.trim()) return;
    setPending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("language", "en-US");
      formData.set(
        "consentRecording",
        consent.blob,
        recordingFileName("consent", consent.blob.type),
      );
      formData.set(
        "voiceSample",
        sample.blob,
        recordingFileName("sample", sample.blob.type),
      );
      const response = await fetch(`/api/projects/${projectId}/custom-voices`, {
        method: "POST",
        body: formData,
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          typeof Reflect.get(payload, "error") === "string"
            ? String(Reflect.get(payload, "error"))
            : "The custom voice could not be created.";
        setError(message);
        return;
      }
      consent.reset();
      sample.reset();
      setName("");
      await onCreated();
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Clone your voice</DialogTitle>
          <DialogDescription>
            Only clone your own voice. Recordings are sent directly to OpenAI
            and are not stored in VCStudio.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="custom-voice-name">Voice name</Label>
            <Input
              id="custom-voice-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-sm font-medium">1. Consent recording</p>
            <p className="text-sm text-muted-foreground">Read this exactly:</p>
            <blockquote className="rounded-md bg-muted p-3 text-sm">
              {CUSTOM_VOICE_CONSENT_PHRASE}
            </blockquote>
            <Button
              type="button"
              variant="outline"
              onClick={
                consent.state === "recording" ? consent.stop : consent.start
              }
            >
              {consent.state === "recording"
                ? "Stop consent recording"
                : consent.blob
                  ? "Record consent again"
                  : "Record consent"}
            </Button>
            {consent.blob ? (
              <p className="text-xs text-emerald-600">
                Consent recording ready.
              </p>
            ) : null}
            {consent.error ? (
              <p className="text-sm text-destructive">{consent.error}</p>
            ) : null}
          </div>
          <div className="space-y-2 rounded-lg border p-4">
            <p className="text-sm font-medium">2. Voice sample</p>
            <p className="text-sm text-muted-foreground">
              Record 30–60 seconds of clean, natural speech in a quiet room.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={
                sample.state === "recording" ? sample.stop : sample.start
              }
            >
              {sample.state === "recording"
                ? "Stop voice sample"
                : sample.blob
                  ? "Record sample again"
                  : "Record sample"}
            </Button>
            {sample.blob ? (
              <p className="text-xs text-emerald-600">Voice sample ready.</p>
            ) : null}
            {sample.error ? (
              <p className="text-sm text-destructive">{sample.error}</p>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || !name.trim() || !consent.blob || !sample.blob}
            onClick={submit}
          >
            {pending ? "Creating voice…" : "Create custom voice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
