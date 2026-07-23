"use client";

import type { FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
            placeholder="e.g. personal finance for students"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="idea-platform">Platform</Label>
          <select
            className="h-8 w-full rounded-lg border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            defaultValue=""
            disabled={!canEdit}
            id="idea-platform"
            name="platform"
          >
            <option value="">Any platform (best fit per idea)</option>
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="idea-count">How many</Label>
          <select
            className="h-8 w-full rounded-lg border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            defaultValue={String(safeDefault)}
            disabled={!canEdit}
            id="idea-count"
            name="count"
          >
            {counts.map((count) => (
              <option key={count} value={count}>
                {count} ideas
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="idea-tone">Tone / style (optional)</Label>
          <Input
            disabled={!canEdit}
            id="idea-tone"
            maxLength={200}
            name="tonePreference"
            placeholder="e.g. warm and encouraging, or dry and witty"
          />
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
