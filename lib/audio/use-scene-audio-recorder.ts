"use client";

import { useCallback, useRef, useState } from "react";

export type SceneAudioRecorderState =
  "idle" | "recording" | "stopped" | "error";

export interface SceneAudioRecorderResult {
  state: SceneAudioRecorderState;
  elapsedMs: number;
  durationMs: number | null;
  blob: Blob | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

function isRecordingSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

function preferredMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return undefined;
}

/**
 * Wraps getUserMedia + MediaRecorder for in-browser narration recording.
 * Duration is tracked from the recorder's own start/stop timestamps rather
 * than read back from the recorded blob — Chromium reports `Infinity` for a
 * blob-URL webm's `.duration` immediately after creation, so timing it here
 * is the reliable source, not a shortcut.
 */
export function useSceneAudioRecorder(): SceneAudioRecorderResult {
  const [state, setState] = useState<SceneAudioRecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    setDurationMs(null);
    if (!isRecordingSupported()) {
      setError("Recording isn't supported in this browser.");
      setState("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = stream;
      const mimeType = preferredMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        setDurationMs(Date.now() - startedAtRef.current);
        setBlob(new Blob(chunksRef.current, { type: recorder.mimeType }));
        stopStream();
      };
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);
      setState("recording");
    } catch {
      setError("Microphone access was denied or is unavailable.");
      setState("error");
    }
  }, [stopStream]);

  const stop = useCallback(() => {
    stopTimer();
    mediaRecorderRef.current?.stop();
    setState("stopped");
  }, [stopTimer]);

  const reset = useCallback(() => {
    stopTimer();
    stopStream();
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setBlob(null);
    setDurationMs(null);
    setError(null);
    setElapsedMs(0);
    setState("idle");
  }, [stopStream, stopTimer]);

  return { state, elapsedMs, durationMs, blob, error, start, stop, reset };
}
