"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { archiveIdeaAction } from "@/app/(authenticated)/app/ideas/actions";
import { IdeaCardBody } from "@/components/ideas/IdeaCardBody";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import type { SavedIdeaView } from "@/lib/ideas/ideas-view";
import { cn } from "@/lib/utils";

export function SavedIdeaCard({
  idea,
  canEdit,
  onArchived,
}: {
  idea: SavedIdeaView;
  canEdit: boolean;
  onArchived: (id: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function archive() {
    startTransition(async () => {
      setError(null);
      const data = new FormData();
      data.set("ideaId", idea.id);
      const result = await archiveIdeaAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onArchived(idea.id);
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
            Saved {idea.createdAtLabel}
          </span>
        )}
        {canEdit ? (
          <div className="flex items-center gap-1">
            <Link
              className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
              href={`/app/projects?ideaId=${idea.id}`}
            >
              Start project
            </Link>
            <Button
              disabled={pending}
              onClick={archive}
              size="sm"
              variant="ghost"
            >
              {pending ? "Removing…" : "Remove"}
            </Button>
          </div>
        ) : null}
      </CardFooter>
    </Card>
  );
}
