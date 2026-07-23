"use client";

import { useState, useTransition } from "react";
import type { ProjectBrief } from "@/db/schema";
import { saveProjectBriefAction } from "@/app/(authenticated)/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function BriefForm({
  projectId,
  brief,
  canEdit,
}: {
  projectId: string;
  brief: ProjectBrief | null;
  canEdit: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setSaved(false);
          const result = await saveProjectBriefAction(formData);
          setError(result.error);
          setSaved(result.success);
        })
      }
      className="space-y-4 rounded-xl border bg-muted/20 p-4"
    >
      <input name="projectId" type="hidden" value={projectId} />
      <div>
        <h2 className="text-sm font-semibold">Content brief</h2>
        <p className="text-xs text-muted-foreground">
          What the video is about. Powers AI script, title, and thumbnail
          generation — the more specific, the better the output.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="brief-topic">Topic / idea</Label>
        <Textarea
          defaultValue={brief?.topic ?? ""}
          disabled={!canEdit}
          id="brief-topic"
          maxLength={2000}
          name="topic"
          placeholder="e.g. Why most people fail at saving money — and the one habit that fixes it"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="brief-niche">Niche (optional)</Label>
        <Input
          defaultValue={brief?.niche ?? ""}
          disabled={!canEdit}
          id="brief-niche"
          maxLength={120}
          name="niche"
          placeholder="e.g. History, Personal finance, Health & fitness"
        />
        <p className="text-xs text-muted-foreground">
          A history-related niche (or topic) automatically switches AI script
          generation into a strict factual-accuracy mode — no invented events,
          quotes, or statistics.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="brief-audience">Target audience</Label>
          <Input
            defaultValue={brief?.targetAudience ?? ""}
            disabled={!canEdit}
            id="brief-audience"
            maxLength={1000}
            name="targetAudience"
            placeholder="e.g. 20–35yo beginners to personal finance"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brief-tone">Tone / style</Label>
          <Input
            defaultValue={brief?.tone ?? ""}
            disabled={!canEdit}
            id="brief-tone"
            maxLength={500}
            name="tone"
            placeholder="e.g. energetic, direct, a little contrarian"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="brief-platform">Primary platform</Label>
          <select
            className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
            defaultValue={brief?.primaryPlatform ?? "youtube"}
            disabled={!canEdit}
            id="brief-platform"
            name="primaryPlatform"
          >
            <option value="youtube">YouTube</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="brief-duration">Target duration (seconds)</Label>
          <Input
            defaultValue={brief?.targetDurationSeconds ?? ""}
            disabled={!canEdit}
            id="brief-duration"
            max={7200}
            min={1}
            name="targetDurationSeconds"
            placeholder="e.g. 60"
            type="number"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="brief-hook">Hook angle (optional)</Label>
        <Input
          defaultValue={brief?.hookAngle ?? ""}
          disabled={!canEdit}
          id="brief-hook"
          maxLength={1000}
          name="hookAngle"
          placeholder="e.g. open with a surprising statistic"
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {saved && !error ? (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Brief saved.
        </p>
      ) : null}
      {canEdit ? (
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : "Save brief"}
        </Button>
      ) : null}
    </form>
  );
}
