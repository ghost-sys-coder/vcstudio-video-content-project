"use client";
import { useElevenLabsVoices } from "@/hooks/useElevenLabsVoices";
import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
export function ElevenLabsVoiceFields({
  voice,
  onVoiceChange,
  onModelChange,
}: {
  voice: string;
  onVoiceChange: (v: string) => void;
  onModelChange: (v: string) => void;
}) {
  const { voices, cursor, pending, error, loadMore } = useElevenLabsVoices(
    onVoiceChange,
    onModelChange,
  );
  return (
    <div className="space-y-2">
      <Label htmlFor="elevenlabs-voice">ElevenLabs account voice</Label>
      <FormSelect
        id="elevenlabs-voice"
        disabled={pending || !voices.length}
        value={voices.some((v) => v.id === voice) ? voice : ""}
        onValueChange={onVoiceChange}
      >
        {voices.map((v) => (
          <SelectItem key={v.id} value={v.id}>
            {v.name}
          </SelectItem>
        ))}
      </FormSelect>
      <p className="text-xs text-muted-foreground" role="status">
        {pending
          ? "Loading account voices…"
          : "Private in-house service · MP3, WAV or Opus · 70–120% speed. Uses ElevenLabs credits."}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {cursor || error ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => void loadMore()}
        >
          {error ? "Retry" : "Load more voices"}
        </Button>
      ) : null}
    </div>
  );
}
