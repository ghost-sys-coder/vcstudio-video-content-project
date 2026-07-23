"use client";

import { useMemo, useState, useTransition } from "react";
import { createProjectAction } from "@/app/(authenticated)/app/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectAspectRatio } from "@/db/schema";
import type { IdeaNicheGroup, SavedIdeaView } from "@/lib/ideas/ideas-view";
import {
  suggestAspectRatioForPlatform,
  suggestProjectNameFromTopic,
} from "@/lib/ideas/project-seed-from-idea";

export function CreateProjectForm({
  defaultBudgetCents,
  ideaGroups,
  initialIdeaId,
}: {
  defaultBudgetCents: number;
  ideaGroups: IdeaNicheGroup[];
  initialIdeaId?: string | null;
}) {
  const ideasById = useMemo(() => {
    const map = new Map<string, SavedIdeaView>();
    for (const group of ideaGroups)
      for (const idea of group.ideas) map.set(idea.id, idea);
    return map;
  }, [ideaGroups]);

  const initialIdea = initialIdeaId
    ? (ideasById.get(initialIdeaId) ?? null)
    : null;
  const [ideaId, setIdeaId] = useState(initialIdea?.id ?? "");
  const [name, setName] = useState(
    initialIdea ? suggestProjectNameFromTopic(initialIdea.topic) : "",
  );
  const [aspectRatio, setAspectRatio] = useState<ProjectAspectRatio>(
    initialIdea
      ? suggestAspectRatioForPlatform(initialIdea.primaryPlatform)
      : "16:9",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function applyIdea(id: string) {
    setIdeaId(id);
    const idea = ideasById.get(id);
    if (!idea) return;
    setName(suggestProjectNameFromTopic(idea.topic));
    setAspectRatio(suggestAspectRatioForPlatform(idea.primaryPlatform));
  }

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
      <input name="ideaId" type="hidden" value={ideaId} />
      {ideaGroups.length ? (
        <div className="space-y-2">
          <Label htmlFor="project-idea">Start from a saved idea</Label>
          <select
            className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
            id="project-idea"
            onChange={(event) => applyIdea(event.target.value)}
            value={ideaId}
          >
            <option value="">Blank project</option>
            {ideaGroups.map((group) => (
              <optgroup key={group.niche} label={group.niche}>
                {group.ideas.map((idea) => (
                  <option key={idea.id} value={idea.id}>
                    {idea.topic || "(untitled idea)"}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Prefills the project name, aspect ratio, and brief from the idea —
            everything below stays editable.
          </p>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="project-name">Project name</Label>
        <Input
          id="project-name"
          maxLength={100}
          name="name"
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
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
            id="project-ratio"
            name="aspectRatio"
            onChange={(event) =>
              setAspectRatio(event.target.value as ProjectAspectRatio)
            }
            value={aspectRatio}
          >
            <option value="16:9">16:9</option>
            <option value="9:16">9:16</option>
            <option value="1:1">1:1</option>
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
