"use client";

import { useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NarrationInstructionsField } from "@/components/audio/NarrationInstructionsField";
import { AUDIO_FORMATS } from "@/lib/schemas/scene-audio";
import type { SceneAudioActionResult } from "@/lib/audio/audio-view";

const OPENAI_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
];

export function VoicePresetForm({
  open,
  onOpenChange,
  defaultModel,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultModel: string;
  onCreate: (formData: FormData) => Promise<SceneAudioActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [voice, setVoice] = useState(OPENAI_VOICES[0]!);
  const [model, setModel] = useState(defaultModel);
  const [instructions, setInstructions] = useState("");
  const [format, setFormat] = useState<string>("mp3");
  const [speed, setSpeed] = useState(100);
  const [isDefault, setIsDefault] = useState(false);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New voice preset</DialogTitle>
          <DialogDescription>
            Save a reusable voice, model, and delivery style for narration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="voice-preset-name">Name</Label>
            <Input
              id="voice-preset-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Documentary narrator"
              value={name}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="voice-preset-voice">Voice</Label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                id="voice-preset-voice"
                onChange={(event) => setVoice(event.target.value)}
                value={voice}
              >
                {OPENAI_VOICES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="voice-preset-format">Format</Label>
              <select
                className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                id="voice-preset-format"
                onChange={(event) => setFormat(event.target.value)}
                value={format}
              >
                {AUDIO_FORMATS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="voice-preset-model">Model</Label>
            <Input
              id="voice-preset-model"
              onChange={(event) => setModel(event.target.value)}
              value={model}
            />
          </div>
          <NarrationInstructionsField
            id="voice-preset-instructions"
            onChange={setInstructions}
            value={instructions}
          />
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="voice-preset-speed">Speed ({speed}%)</Label>
              <input
                className="w-full accent-primary"
                id="voice-preset-speed"
                max={400}
                min={25}
                onChange={(event) => setSpeed(Number(event.target.value))}
                step={5}
                type="range"
                value={speed}
              />
            </div>
            <label className="flex items-center gap-2 pt-4 text-sm">
              <input
                checked={isDefault}
                className="size-4 accent-primary"
                onChange={(event) => setIsDefault(event.target.checked)}
                type="checkbox"
              />
              Default
            </label>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button
            disabled={pending || name.trim().length === 0}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const formData = new FormData();
                formData.set("name", name);
                formData.set("voice", voice);
                formData.set("model", model);
                formData.set("instructions", instructions);
                formData.set("format", format);
                formData.set("speedScaledPercent", String(speed));
                formData.set("isDefault", isDefault ? "true" : "false");
                const result = await onCreate(formData);
                if (result.success) onOpenChange(false);
                else setError(result.error);
              })
            }
            type="button"
          >
            {pending ? "Saving…" : "Save voice preset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
