"use client";

import { useState, useTransition } from "react";
import { createProjectAction } from "@/app/(authenticated)/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function CreateProjectForm({
  defaultBudgetCents,
}: {
  defaultBudgetCents: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          const result = await createProjectAction(formData);
          if (result?.error) setError(result.error);
        })
      }
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="project-name">Project name</Label>
        <Input id="project-name" name="name" required maxLength={100} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-description">Description</Label>
        <Textarea
          id="project-description"
          name="description"
          maxLength={2000}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="project-ratio">Aspect ratio</Label>
          <select
            className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
            defaultValue="16:9"
            id="project-ratio"
            name="aspectRatio"
          >
            <option>16:9</option>
            <option>9:16</option>
            <option>1:1</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-fps">Frame rate</Label>
          <select
            className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
            defaultValue="30"
            id="project-fps"
            name="framesPerSecond"
          >
            <option>24</option>
            <option>25</option>
            <option>30</option>
            <option>60</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-language">Language</Label>
          <Input
            defaultValue="English"
            id="project-language"
            name="language"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-budget">Maximum budget (USD)</Label>
          <Input
            defaultValue={(defaultBudgetCents / 100).toFixed(2)}
            id="project-budget"
            min="0"
            name="budgetDollars"
            step="0.01"
            type="number"
          />
        </div>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button disabled={pending} type="submit">
        {pending ? "Creating…" : "Create project"}
      </Button>
    </form>
  );
}
