"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceRecordingCapture } from "@/lib/audio/voice-enrollment-requirements";

export type VoiceEnrollmentRecorderState =
  "idle" | "recording" | "captured" | "error";

export interface VoiceEnrollmentRecording {
  blob: Blob;
  objectUrl: string;
  capture: VoiceRecordingCapture;
}

export interface VoiceEnrollmentRecorderResult {
  state: VoiceEnrollmentRecorderState;
  elapsedMs: number;
  /** Live input level, 0–1, while recording. Drives the meter. */
  inputLevel: number;
  recording: VoiceEnrollmentRecording | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

function preferredMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  for (const candidate of ["audio/webm", "audio/mp4", "audio/ogg"])
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  return undefined;
}

/**
 * Records an enrollment clip and measures it while it is being captured.
 *
 * Level is sampled live through an `AnalyserNode` rather than decoded from the
 * finished blob: `decodeAudioData` cannot read a partial WebM container in
 * Chromium, and blob-URL duration reads back as `Infinity` there, so both the
 * duration and the loudness have to be taken from the live graph or they are
 * not available at all.
 */
export function useVoiceEnrollmentRecorder(): VoiceEnrollmentRecorderResult {
  const [state, setState] = useState<VoiceEnrollmentRecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [inputLevel, setInputLevel] = useState(0);
  const [recording, setRecording] = useState<VoiceEnrollmentRecording | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const peakRef = useRef(0);
  const levelSumRef = useRef(0);
  const levelCountRef = useRef(0);
  const objectUrlRef = useRef<string | null>(null);

  const releaseHardware = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
  }, []);

  useEffect(
    () => () => {
      releaseHardware();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [releaseHardware],
  );

  const start = useCallback(async () => {
    setError(null);
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setRecording(null);
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("Recording isn't supported in this browser.");
      setState("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      peakRef.current = 0;
      levelSumRef.current = 0;
      levelCountRef.current = 0;

      const measure = () => {
        analyser.getFloatTimeDomainData(samples);
        let sumOfSquares = 0;
        let framePeak = 0;
        for (const sample of samples) {
          sumOfSquares += sample * sample;
          const magnitude = Math.abs(sample);
          if (magnitude > framePeak) framePeak = magnitude;
        }
        const rootMeanSquare = Math.sqrt(sumOfSquares / samples.length);
        peakRef.current = Math.max(peakRef.current, framePeak);
        levelSumRef.current += rootMeanSquare;
        levelCountRef.current += 1;
        setInputLevel(Math.min(1, framePeak));
        frameRef.current = requestAnimationFrame(measure);
      };
      frameRef.current = requestAnimationFrame(measure);

      const mimeType = preferredMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const durationMilliseconds = Date.now() - startedAtRef.current;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        setRecording({
          blob,
          objectUrl,
          capture: {
            sizeBytes: blob.size,
            mimeType: recorder.mimeType,
            durationMilliseconds,
            peakLevel: peakRef.current,
            averageLevel: levelCountRef.current
              ? levelSumRef.current / levelCountRef.current
              : 0,
          },
        });
        setInputLevel(0);
        setState("captured");
        releaseHardware();
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);
      setState("recording");
    } catch {
      releaseHardware();
      setError("Microphone access was denied or is unavailable.");
      setState("error");
    }
  }, [releaseHardware]);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    releaseHardware();
    recorderRef.current = null;
    chunksRef.current = [];
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setRecording(null);
    setElapsedMs(0);
    setInputLevel(0);
    setError(null);
    setState("idle");
  }, [releaseHardware]);

  return { state, elapsedMs, inputLevel, recording, error, start, stop, reset };
}
