"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useState, useTransition } from "react";
import { applyIdeaToBriefAction } from "@/app/(authenticated)/app/projects/actions";
import type { IdeaNicheGroup } from "@/lib/ideas/ideas-view";

export function StartFromIdeaSelect({
  projectId,
  groups,
  canEdit,
}: {
  projectId: string;
  groups: IdeaNicheGroup[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canEdit) return null;

  if (groups.length === 0)
    return (
      <p className="text-xs text-muted-foreground">
        No saved ideas yet. Brainstorm in the{" "}
        <Link className="underline" href="/app/ideas">
          Idea Lab
        </Link>{" "}
        to prefill this brief.
      </p>
    );

  function apply(event: ChangeEvent<HTMLSelectElement>) {
    const ideaId = event.target.value;
    if (!ideaId) return;
    startTransition(async () => {
      setError(null);
      setApplied(false);
      const data = new FormData();
      data.set("projectId", projectId);
      data.set("ideaId", ideaId);
      const result = await applyIdeaToBriefAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setApplied(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs font-medium" htmlFor="start-from-idea">
        Start from a saved idea
      </label>
      <select
        className="h-8 rounded-lg border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        defaultValue=""
        disabled={pending}
        id="start-from-idea"
        onChange={apply}
      >
        <option value="">Choose an idea…</option>
        {groups.map((group) => (
          <optgroup key={group.niche} label={group.niche}>
            {group.ideas.map((idea) => (
              <option key={idea.id} value={idea.id}>
                {idea.topic || "(untitled idea)"}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {pending ? (
        <span className="text-xs text-muted-foreground" role="status">
          Applying…
        </span>
      ) : null}
      {applied && !pending ? (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          Brief updated from idea.
        </span>
      ) : null}
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
