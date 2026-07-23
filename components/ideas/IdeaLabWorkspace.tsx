"use client";

import { useState, useTransition } from "react";
import { generateIdeasAction } from "@/app/(authenticated)/app/ideas/actions";
import { GeneratedIdeaCard } from "@/components/ideas/GeneratedIdeaCard";
import { IdeaGeneratorForm } from "@/components/ideas/IdeaGeneratorForm";
import { IdeaLibrary } from "@/components/ideas/IdeaLibrary";
import type {
  IdeaLabView,
  IdeaNicheGroup,
  SavedIdeaView,
} from "@/lib/ideas/ideas-view";
import type { GeneratedIdea } from "@/lib/schemas/idea-generation";

type Generation = {
  niche: string;
  runId: string;
  ideas: GeneratedIdea[];
};

export function IdeaLabWorkspace({
  canEdit,
  view,
}: {
  canEdit: boolean;
  view: IdeaLabView;
}) {
  const [groups, setGroups] = useState<IdeaNicheGroup[]>(view.groups);
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate(formData: FormData) {
    startTransition(async () => {
      setError(null);
      formData.set("requestNonce", crypto.randomUUID());
      const result = await generateIdeasAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setGeneration({
        niche: result.niche,
        runId: result.runId,
        ideas: result.ideas,
      });
    });
  }

  function handleSaved(idea: SavedIdeaView) {
    setGroups((current) => {
      const index = current.findIndex((group) => group.niche === idea.niche);
      if (index === -1)
        return [{ niche: idea.niche, ideas: [idea] }, ...current];
      const next = [...current];
      next[index] = { niche: idea.niche, ideas: [idea, ...next[index].ideas] };
      return next;
    });
  }

  function handleArchived(id: string) {
    setGroups((current) =>
      current
        .map((group) => ({
          ...group,
          ideas: group.ideas.filter((idea) => idea.id !== id),
        }))
        .filter((group) => group.ideas.length > 0),
    );
  }

  return (
    <section className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Ideation
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Idea Lab</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Brainstorm video ideas for any niche, save the best, and turn them
          into projects. Each saved idea fills in a project brief on the script
          screen.
        </p>
      </div>

      <IdeaGeneratorForm
        canEdit={canEdit}
        defaultCount={view.defaultCount}
        estimatedCostCents={view.estimatedCostCents}
        maxPerBatch={view.maxPerBatch}
        model={view.model}
        onGenerate={generate}
        pending={pending}
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {generation ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">
            Ideas for <span className="capitalize">{generation.niche}</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Save the ones worth developing. They appear in your library below,
            grouped by niche.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {generation.ideas.map((idea, index) => (
              <GeneratedIdeaCard
                key={`${generation.runId}-${index}`}
                canEdit={canEdit}
                idea={idea}
                niche={generation.niche}
                onSaved={handleSaved}
                runId={generation.runId}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Your idea library</h2>
        <IdeaLibrary
          canEdit={canEdit}
          groups={groups}
          onArchived={handleArchived}
        />
      </section>
    </section>
  );
}
