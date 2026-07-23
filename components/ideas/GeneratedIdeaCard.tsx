"use client";

import { useState, useTransition } from "react";
import { saveIdeaAction } from "@/app/(authenticated)/app/ideas/actions";
import { IdeaCardBody } from "@/components/ideas/IdeaCardBody";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import type { SavedIdeaView } from "@/lib/ideas/ideas-view";
import type { GeneratedIdea } from "@/lib/schemas/idea-generation";

export function GeneratedIdeaCard({
  niche,
  runId,
  idea,
  canEdit,
  onSaved,
}: {
  niche: string;
  runId: string;
  idea: GeneratedIdea;
  canEdit: boolean;
  onSaved: (idea: SavedIdeaView) => void;
}) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      setError(null);
      const data = new FormData();
      data.set("niche", niche);
      data.set("generationRunId", runId);
      data.set("topic", idea.topic);
      data.set("targetAudience", idea.targetAudience);
      data.set("tone", idea.tone);
      if (idea.targetDurationSeconds !== null)
        data.set("targetDurationSeconds", String(idea.targetDurationSeconds));
      data.set("primaryPlatform", idea.primaryPlatform);
      data.set("hookAngle", idea.hookAngle);
      data.set("rationale", idea.rationale);
      data.set("hookType", idea.hookType);
      const result = await saveIdeaAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      onSaved(result.idea);
    });
  }

  return (
    <Card size="sm">
      <CardContent>
        <IdeaCardBody idea={idea} />
      </CardContent>
      <CardFooter className="justify-between gap-2">
        {error ? (
          <span className="text-xs text-destructive">{error}</span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {saved ? "Saved to library" : "AI suggestion"}
          </span>
        )}
        {canEdit ? (
          <Button
            disabled={pending || saved}
            onClick={save}
            size="sm"
            variant={saved ? "ghost" : "default"}
          >
            {saved ? "Saved" : pending ? "Saving…" : "Save idea"}
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}
