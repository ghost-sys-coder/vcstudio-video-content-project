"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveOperationalLimitsAction } from "@/app/(authenticated)/app/usage/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OperationalLimitsForm({
  workspaceId,
  maxImagesPerBatch,
  maxScenesPerAudioBatch,
  maxRenderDurationSeconds,
  defaults,
}: {
  workspaceId: string;
  maxImagesPerBatch: number | null;
  maxScenesPerAudioBatch: number | null;
  maxRenderDurationSeconds: number | null;
  defaults: {
    maxImagesPerBatch: number;
    maxScenesPerAudioBatch: number;
    maxRenderDurationSeconds: number;
  };
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await saveOperationalLimitsAction(formData);
      if (!result.success) {
        setError(result.error ?? "The limits could not be saved.");
        return;
      }
      setMessage("Operational limits saved.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Operational limits</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={submit} className="space-y-5">
          <input name="workspaceId" type="hidden" value={workspaceId} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="max-images-batch">Images per batch</Label>
              <Input
                defaultValue={maxImagesPerBatch ?? ""}
                disabled={pending}
                id="max-images-batch"
                min="1"
                name="maxImagesPerBatch"
                placeholder={`Default ${defaults.maxImagesPerBatch}`}
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-audio-batch">Scenes per audio batch</Label>
              <Input
                defaultValue={maxScenesPerAudioBatch ?? ""}
                disabled={pending}
                id="max-audio-batch"
                min="1"
                name="maxScenesPerAudioBatch"
                placeholder={`Default ${defaults.maxScenesPerAudioBatch}`}
                type="number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-render-seconds">Max render seconds</Label>
              <Input
                defaultValue={maxRenderDurationSeconds ?? ""}
                disabled={pending}
                id="max-render-seconds"
                min="1"
                name="maxRenderDurationSeconds"
                placeholder={`Default ${defaults.maxRenderDurationSeconds}`}
                type="number"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Leave a field blank to use the deployment default.
          </p>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm text-emerald-700" role="status">
              {message}
            </p>
          ) : null}
          <Button disabled={pending} type="submit">
            {pending ? "Saving…" : "Save limits"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
