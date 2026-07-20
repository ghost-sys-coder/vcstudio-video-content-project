"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, StarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TitleSuggestionView } from "@/lib/titles/title-view";

export function TitleSuggestionCard({
  suggestion,
  canManage,
  onToggleFavorite,
}: {
  suggestion: TitleSuggestionView;
  canManage: boolean;
  onToggleFavorite: (suggestionId: string, isFavorite: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(suggestion.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <li className="space-y-2 rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium leading-5">{suggestion.text}</p>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            aria-label={copied ? "Copied" : "Copy title"}
            onClick={copy}
            size="icon"
            type="button"
            variant="ghost"
          >
            {copied ? (
              <CheckIcon aria-hidden className="size-4 text-green-600" />
            ) : (
              <CopyIcon aria-hidden className="size-4" />
            )}
          </Button>
          {canManage ? (
            <Button
              aria-label={
                suggestion.isFavorite
                  ? "Remove from favorites"
                  : "Mark as favorite"
              }
              aria-pressed={suggestion.isFavorite}
              onClick={() =>
                onToggleFavorite(suggestion.id, !suggestion.isFavorite)
              }
              size="icon"
              type="button"
              variant="ghost"
            >
              <StarIcon
                aria-hidden
                className={
                  suggestion.isFavorite
                    ? "size-4 fill-amber-400 text-amber-500"
                    : "size-4 text-muted-foreground"
                }
              />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {suggestion.hookType ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {suggestion.hookType}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {suggestion.text.length} chars
        </span>
      </div>
      {suggestion.rationale ? (
        <p className="text-xs text-muted-foreground">{suggestion.rationale}</p>
      ) : null}
    </li>
  );
}
