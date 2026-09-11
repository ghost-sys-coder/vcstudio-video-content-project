"use client";

import { Button } from "@/components/ui/button";
import type { EditorialSourceView } from "@/lib/editorial/editorial-review-view";

/**
 * The sources available to cite on this project.
 *
 * The host is shown beside the title for every link, because a title is chosen
 * by whoever pasted it and a reviewer judging a citation needs to see where it
 * actually goes. Retiring a source archives it; there is no delete, so a claim
 * can never end up citing something that has vanished.
 */
export function EditorialSourceList({
  sources,
  canEdit,
  busy,
  onArchive,
}: {
  sources: EditorialSourceView[];
  canEdit: boolean;
  busy: boolean;
  onArchive: (sourceId: string) => void;
}) {
  if (sources.length === 0)
    return (
      <p className="text-xs text-muted-foreground">
        No sources yet. Add the links and notes you checked against, then cite
        them on the claims below.
      </p>
    );
  return (
    <ul className="space-y-2">
      {sources.map((source) => (
        <li
          className="flex items-start justify-between gap-2 rounded-lg border p-2.5 text-xs"
          key={source.id}
        >
          <span className="min-w-0">
            {source.url ? (
              <a
                className="font-medium underline underline-offset-2"
                href={source.url}
                rel="noopener noreferrer nofollow"
                target="_blank"
              >
                {source.title}
              </a>
            ) : (
              <span className="font-medium">{source.title}</span>
            )}
            <span className="text-muted-foreground">
              {" "}
              · {source.host ?? "note"}
            </span>
            {source.notes ? (
              <span className="mt-0.5 block whitespace-pre-line text-muted-foreground">
                {source.notes}
              </span>
            ) : null}
          </span>
          {canEdit ? (
            <Button
              disabled={busy}
              onClick={() => onArchive(source.id)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Archive
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
