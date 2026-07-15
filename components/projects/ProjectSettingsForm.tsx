"use client";

import { useState, useTransition } from "react";
import type { Project, ProjectStatus } from "@/db/schema";
import { updateProjectAction } from "@/app/(authenticated)/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProjectSettingsForm({
  project,
  allowedStatuses,
  canEdit,
}: {
  project: Project;
  allowedStatuses: ProjectStatus[];
  canEdit: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          setError(null);
          const result = await updateProjectAction(formData);
          setSuccess(result.success);
          setError(result.error);
        })
      }
      className="max-w-2xl space-y-5"
    >
      <input name="projectId" type="hidden" value={project.id} />
      <div className="space-y-2">
        <Label htmlFor="settings-name">Name</Label>
        <Input
          defaultValue={project.name}
          disabled={!canEdit || pending}
          id="settings-name"
          name="name"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-description">Description</Label>
        <Textarea
          defaultValue={project.description}
          disabled={!canEdit || pending}
          id="settings-description"
          name="description"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="settings-ratio">Aspect ratio</Label>
          <select
            className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
            defaultValue={project.aspectRatio}
            disabled={!canEdit || pending}
            id="settings-ratio"
            name="aspectRatio"
          >
            <option>16:9</option>
            <option>9:16</option>
            <option>1:1</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-fps">Frame rate</Label>
          <Input
            defaultValue={project.framesPerSecond}
            disabled={!canEdit || pending}
            id="settings-fps"
            max={120}
            min={1}
            name="framesPerSecond"
            type="number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-language">Language</Label>
          <Input
            defaultValue={project.language}
            disabled={!canEdit || pending}
            id="settings-language"
            name="language"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-budget">Maximum budget (USD)</Label>
          <Input
            defaultValue={(project.maximumBudgetCents / 100).toFixed(2)}
            disabled={!canEdit || pending}
            id="settings-budget"
            min="0"
            name="budgetDollars"
            step="0.01"
            type="number"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-status">Status</Label>
          <select
            className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
            defaultValue={project.status}
            disabled={!canEdit || pending}
            id="settings-status"
            name="status"
          >
            <option value={project.status}>{project.status}</option>
            {allowedStatuses
              .filter((status) => status !== project.status)
              .map((status) => (
                <option key={status}>{status}</option>
              ))}
          </select>
        </div>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-emerald-700" role="status">
          Project settings updated.
        </p>
      ) : null}
      {canEdit ? (
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : "Save settings"}
        </Button>
      ) : null}
    </form>
  );
}
