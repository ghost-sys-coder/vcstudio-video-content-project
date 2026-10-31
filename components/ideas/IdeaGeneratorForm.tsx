"use client";

import { FormSelect } from "@/components/ui/FormSelect";
import { SelectItem } from "@/components/ui/select";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUGGESTED_NICHES } from "@/lib/ideas/suggested-niches";
import { cn } from "@/lib/utils";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function IdeaGeneratorForm({
  canEdit,
  model,
  estimatedCostCents,
  defaultCount,
  maxPerBatch,
  pending,
  onGenerate,
}: {
  canEdit: boolean;
  model: string;
  estimatedCostCents: number;
  defaultCount: number;
  maxPerBatch: number;
  pending: boolean;
  onGenerate: (formData: FormData) => void;
}) {
  const highest = Math.max(3, maxPerBatch);
  const counts = Array.from({ length: highest - 2 }, (_, index) => index + 3);
  const safeDefault = Math.min(Math.max(defaultCount, 3), highest);
  const [niche, setNiche] = useState("");
  const [tone, setTone] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onGenerate(new FormData(event.currentTarget));
  }

  return (
    <form
      className="space-y-4 rounded-xl border bg-muted/20 p-4"
      onSubmit={submit}
    >
      <div>
        <h2 className="text-sm font-semibold">Generate video ideas</h2>
        <p className="text-xs text-muted-foreground">
          Proven, high-retention formats for your niche. These are starting
          points worth testing and A/B comparing — not guaranteed hits.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="idea-niche">Niche or field</Label>
          <Input
            disabled={!canEdit}
            id="idea-niche"
            maxLength={120}
            minLength={2}
            name="niche"
            onChange={(event) => setNiche(event.target.value)}
            placeholder="e.g. personal finance for students"
            required
            value={niche}
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground">Popular:</span>
            {SUGGESTED_NICHES.map((suggestion) => (
              <button
                aria-pressed={niche === suggestion.niche}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                  niche === suggestion.niche &&
                    "border-primary bg-primary/10 text-primary hover:bg-primary/10",
                )}
                disabled={!canEdit}
                key={suggestion.niche}
                onClick={() => {
                  setNiche(suggestion.niche);
                  setTone(suggestion.tone);
                }}
                title={`Suggested tone: ${suggestion.tone}`}
                type="button"
              >
                {suggestion.niche}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="idea-platform">Platform</Label>
          <FormSelect
            defaultValue=""
            disabled={!canEdit}
            id="idea-platform"
            name="platform"
          >
            <SelectItem value="">Any platform (best fit per idea)</SelectItem>
            <SelectItem value="youtube">YouTube</SelectItem>
            <SelectItem value="tiktok">TikTok</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
          </FormSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="idea-count">How many</Label>
          <FormSelect
            defaultValue={String(safeDefault)}
            disabled={!canEdit}
            id="idea-count"
            name="count"
          >
            {counts.map((count) => (
              <SelectItem key={count} value={String(count)}>
                {count} ideas
              </SelectItem>
            ))}
          </FormSelect>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="idea-tone">Tone / style (optional)</Label>
          <Input
            disabled={!canEdit}
            id="idea-tone"
            maxLength={200}
            name="tonePreference"
            onChange={(event) => setTone(event.target.value)}
            placeholder="e.g. warm and encouraging, or dry and witty"
            value={tone}
          />
          <p className="text-xs text-muted-foreground">
            Picking a popular niche suggests a fitting tone here — edit it
            freely.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          ≈{formatCents(estimatedCostCents)} per batch · charged only if
          generation succeeds · {model}
        </p>
        {canEdit ? (
          <Button disabled={pending} type="submit">
            {pending ? "Generating…" : "Generate ideas"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
