"use client";

import { useState } from "react";
import { CustomVoiceAvailabilityNotice } from "@/components/audio/CustomVoiceAvailabilityNotice";
import { VoiceRecordingStepPanel } from "@/components/audio/VoiceRecordingStepPanel";
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
import {
  isEnrollmentBlocked,
  type CustomVoiceAvailability,
} from "@/lib/audio/custom-voice-availability";
import { useVoiceEnrollmentRecorder } from "@/lib/audio/use-voice-enrollment-recorder";
import {
  CONSENT_RECORDING_SPEC,
  SAMPLE_RECORDING_SPEC,
  evaluateVoiceRecording,
  isVoiceRecordingAcceptable,
  voiceRecordingFileName,
} from "@/lib/audio/voice-enrollment-requirements";
import { CUSTOM_VOICE_CONSENT_PHRASE } from "@/lib/schemas/scene-audio";

export function CustomVoiceEnrollmentDialog({
  availability,
  open,
  onOpenChange,
  onCreated,
}: {
  availability: CustomVoiceAvailability;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const consent = useVoiceEnrollmentRecorder();
  const sample = useVoiceEnrollmentRecorder();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocked = isEnrollmentBlocked(availability);
  const consentReady =
    consent.recording !== null &&
    isVoiceRecordingAcceptable(
      evaluateVoiceRecording(CONSENT_RECORDING_SPEC, consent.recording.capture),
    );
  const sampleReady =
    sample.recording !== null &&
    isVoiceRecordingAcceptable(
      evaluateVoiceRecording(SAMPLE_RECORDING_SPEC, sample.recording.capture),
    );
  const canSubmit =
    !blocked &&
    !pending &&
    name.trim().length > 0 &&
    consentReady &&
    sampleReady;

  async function submit() {
    if (!consent.recording || !sample.recording || !canSubmit) return;
    setPending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("language", "en-US");
      formData.set(
        "consentRecording",
        consent.recording.blob,
        voiceRecordingFileName(
          CONSENT_RECORDING_SPEC,
          consent.recording.capture.mimeType,
        ),
      );
      formData.set(
        "voiceSample",
        sample.recording.blob,
        voiceRecordingFileName(
          SAMPLE_RECORDING_SPEC,
          sample.recording.capture.mimeType,
        ),
      );
      const response = await fetch("/api/workspace/custom-voices", {
        method: "POST",
        body: formData,
      });
      const payload: unknown = await response.json().catch(() => null);
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Clone your voice</DialogTitle>
          <DialogDescription>
            Only clone your own voice. Recordings are sent directly to the voice
            provider and are not stored in VCStudio.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <CustomVoiceAvailabilityNotice availability={availability} />
          <div className="space-y-1.5">
            <Label htmlFor="custom-voice-name">Voice name</Label>
            <Input
              id="custom-voice-name"
              maxLength={80}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </div>
          <VoiceRecordingStepPanel
            disabled={blocked || pending}
            instructions={
              <>
                <span>Read this sentence aloud, exactly as written:</span>
                <blockquote className="mt-2 rounded-md bg-muted p-3 text-sm text-foreground">
                  {CUSTOM_VOICE_CONSENT_PHRASE}
                </blockquote>
              </>
            }
            recorder={consent}
            spec={CONSENT_RECORDING_SPEC}
            stepNumber={1}
          />
          <VoiceRecordingStepPanel
            disabled={blocked || pending}
            instructions="Speak naturally for at least 30 seconds in a quiet room — read anything you like, at your normal pace and volume."
            recorder={sample}
            spec={SAMPLE_RECORDING_SPEC}
            stepNumber={2}
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={!canSubmit} onClick={submit} type="button">
            {pending ? "Creating voice…" : "Create custom voice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
