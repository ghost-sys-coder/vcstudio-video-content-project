"use client";

import { useMemo, useState } from "react";
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
import { convertRecordingToWav } from "@/lib/audio/convert-recording-to-wav";
import { useVoiceEnrollmentRecorder } from "@/lib/audio/use-voice-enrollment-recorder";
import {
  CONSENT_RECORDING_SPEC,
  evaluateVoiceRecording,
  isVoiceRecordingAcceptable,
  sampleRecordingSpecFor,
  voiceRecordingFileName,
} from "@/lib/audio/voice-enrollment-requirements";
import type { VoiceEnrollmentDetails } from "@/lib/speech/voice-enrollment-details";

const PROVIDER_NAMES: Record<VoiceEnrollmentDetails["provider"], string> = {
  gemini: "Google Gemini",
  openai: "OpenAI",
};

/**
 * Collects a consent clip and a voice sample for the configured provider.
 *
 * The sentence, the sample length and the file format all come from
 * `enrollment`, because each provider checks its own: Google verifies the
 * consent clip recites its sentence word for word and accepts only WAV.
 */
export function CustomVoiceEnrollmentDialog({
  availability,
  enrollment,
  open,
  onOpenChange,
  onCreated,
}: {
  availability: CustomVoiceAvailability;
  enrollment: VoiceEnrollmentDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const consent = useVoiceEnrollmentRecorder();
  const sample = useVoiceEnrollmentRecorder();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sampleSpec = useMemo(
    () => (enrollment ? sampleRecordingSpecFor(enrollment.sample) : null),
    [enrollment],
  );
  const blocked = isEnrollmentBlocked(availability) || !enrollment;
  const consentReady =
    consent.recording !== null &&
    isVoiceRecordingAcceptable(
      evaluateVoiceRecording(CONSENT_RECORDING_SPEC, consent.recording.capture),
    );
  const sampleReady =
    sampleSpec !== null &&
    sample.recording !== null &&
    isVoiceRecordingAcceptable(
      evaluateVoiceRecording(sampleSpec, sample.recording.capture),
    );
  const canSubmit =
    !blocked &&
    !pending &&
    name.trim().length > 0 &&
    consentReady &&
    sampleReady;

  async function submit() {
    if (
      !consent.recording ||
      !sample.recording ||
      !enrollment ||
      !sampleSpec ||
      !canSubmit
    )
      return;
    setPending(true);
    setError(null);
    try {
      let consentBlob: Blob = consent.recording.blob;
      let sampleBlob: Blob = sample.recording.blob;
      if (enrollment.recordingFormat === "wav") {
        try {
          [consentBlob, sampleBlob] = await Promise.all([
            convertRecordingToWav(consentBlob),
            convertRecordingToWav(sampleBlob),
          ]);
        } catch {
          setError(
            "This browser could not convert the recordings to WAV, which the voice provider requires. Try again in Chrome or Edge.",
          );
          return;
        }
      }
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("language", "en-US");
      formData.set(
        "consentRecording",
        consentBlob,
        voiceRecordingFileName(CONSENT_RECORDING_SPEC, consentBlob.type),
      );
      formData.set(
        "voiceSample",
        sampleBlob,
        voiceRecordingFileName(sampleSpec, sampleBlob.type),
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
            Only clone your own voice. Recordings are sent directly to{" "}
            {enrollment
              ? PROVIDER_NAMES[enrollment.provider]
              : "the voice provider"}{" "}
            and are not stored in VCStudio.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <CustomVoiceAvailabilityNotice availability={availability} />
          {!enrollment && !isEnrollmentBlocked(availability) ? (
            <p className="text-sm text-destructive" role="alert">
              The recording requirements could not be loaded, so nothing can be
              recorded yet. Close this dialog and try again.
            </p>
          ) : null}
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
                  {enrollment?.consentPhrase ?? "…"}
                </blockquote>
              </>
            }
            recorder={consent}
            spec={CONSENT_RECORDING_SPEC}
            stepNumber={1}
          />
          {enrollment && sampleSpec ? (
            <VoiceRecordingStepPanel
              disabled={blocked || pending}
              instructions={`Speak naturally for ${enrollment.sample.minimumSeconds} to ${enrollment.sample.maximumSeconds} seconds in a quiet room — read anything you like, at your normal pace and volume.`}
              recorder={sample}
              spec={sampleSpec}
              stepNumber={2}
            />
          ) : null}
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
