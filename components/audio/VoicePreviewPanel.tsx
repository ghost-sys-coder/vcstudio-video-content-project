"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2Icon, PauseIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_PREVIEW_VOICE_ID,
  VOICE_OPTIONS,
  VOICE_PREVIEW_SAMPLE_TEXT,
} from "@/lib/audio/voice-catalog";

type PreviewStatus = "idle" | "loading" | "playing" | "error";

export function VoicePreviewPanel() {
  const [voice, setVoice] = useState<string>(DEFAULT_PREVIEW_VOICE_ID);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const items = useMemo(
    () =>
      Object.fromEntries(
        VOICE_OPTIONS.map((option) => [option.id, option.label]),
      ),
    [],
  );
  const selected = VOICE_OPTIONS.find((option) => option.id === voice);

  function stop() {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setStatus("idle");
  }

  function handleVoiceChange(next: string) {
    stop();
    setVoice(next);
  }

  function play() {
    const audio = audioRef.current;
    if (!audio) return;
    setStatus("loading");
    audio.src = `/api/audio/voice-preview?voice=${encodeURIComponent(voice)}`;
    audio.play().catch(() => setStatus("error"));
  }

  const isBusy = status === "loading" || status === "playing";

  return (
    <section className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div>
        <h2 className="text-sm font-semibold">Preview voices</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a voice and hear it read the same sample line, so you can compare
          how each one sounds before you configure a voice preset.
        </p>
      </div>

      <blockquote className="rounded-lg border bg-muted/40 p-3 text-sm text-foreground/90 italic">
        “{VOICE_PREVIEW_SAMPLE_TEXT}”
      </blockquote>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="voice-preview-select">
            Voice
          </Label>
          <Select
            items={items}
            onValueChange={(value) => handleVoiceChange(String(value))}
            value={voice}
          >
            <SelectTrigger className="min-w-56" id="voice-preview-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICE_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  <span className="font-medium">{option.label}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {option.description}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          disabled={status === "loading"}
          onClick={() => (isBusy ? stop() : play())}
          type="button"
          variant="outline"
        >
          {status === "loading" ? (
            <>
              <Loader2Icon aria-hidden className="animate-spin" />
              Loading…
            </>
          ) : status === "playing" ? (
            <>
              <PauseIcon aria-hidden />
              Stop
            </>
          ) : (
            <>
              <PlayIcon aria-hidden />
              Play sample
            </>
          )}
        </Button>

        {selected ? (
          <p className="text-xs text-muted-foreground">
            {selected.label}: {selected.description}
          </p>
        ) : null}
      </div>

      {status === "error" ? (
        <p className="text-xs text-destructive" role="alert">
          That voice sample could not be loaded. Please try again.
        </p>
      ) : null}

      <audio
        className="sr-only"
        onEnded={() => setStatus("idle")}
        onError={() => setStatus("error")}
        onPlaying={() => setStatus("playing")}
        ref={audioRef}
      >
        <track kind="captions" />
      </audio>
    </section>
  );
}
