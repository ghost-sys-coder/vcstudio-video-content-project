"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import {
  deleteDocumentAction,
  summariseDocumentAction,
  updateDocumentAction,
} from "@/app/(authenticated)/app/marketing/assets/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { KnowledgeDocumentView } from "@/lib/marketing/documents/documents-view";

const STATUS_TONE = {
  ready:
    "border-notice-ready-edge bg-notice-ready text-notice-ready-foreground",
  pending: "border-notice-info-edge bg-notice-info text-notice-info-foreground",
  extracting:
    "border-notice-info-edge bg-notice-info text-notice-info-foreground",
  failed:
    "border-notice-warning-edge bg-notice-warning text-notice-warning-foreground",
} as const;

export function KnowledgeDocumentRow({
  document,
}: {
  document: KnowledgeDocumentView;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateDocumentAction(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function summarise() {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("documentId", document.id);
      const result = await summariseDocumentAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("documentId", document.id);
      const result = await deleteDocumentAction(data);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="space-y-3 rounded-xl border p-3">
      <form action={save} className="space-y-3">
        <input name="documentId" type="hidden" value={document.id} />

        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-2">
            <Label className="sr-only" htmlFor={`title-${document.id}`}>
              Title
            </Label>
            <Input
              defaultValue={document.title}
              disabled={pending}
              id={`title-${document.id}`}
              name="title"
              required
            />
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span
                className={`rounded-md border px-1.5 py-0.5 ${STATUS_TONE[document.status]}`}
              >
                {document.status}
              </span>
              <span>{document.characterCount.toLocaleString()} characters</span>
              <span>~{document.tokenEstimate.toLocaleString()} tokens</span>
              {document.sourceKind === "pasted" ? <span>Pasted</span> : null}
            </p>
          </div>
        </div>

        {document.safeErrorMessage ? (
          <p className="text-xs text-notice-warning-foreground">
            {document.safeErrorMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap items-end gap-4">
          <Label className="flex items-center gap-2 text-sm">
            <input
              defaultChecked={document.includeInContext}
              disabled={pending || document.status !== "ready"}
              name="includeInContext"
              type="checkbox"
            />
            <span>Include in the studio&apos;s context</span>
          </Label>

          <div className="space-y-1">
            <Label className="text-xs" htmlFor={`priority-${document.id}`}>
              Priority
            </Label>
            <Input
              className="w-24"
              defaultValue={document.priority}
              disabled={pending}
              id={`priority-${document.id}`}
              max={100}
              min={0}
              name="priority"
              type="number"
            />
          </div>

          <Button
            className="ml-auto"
            disabled={pending}
            size="sm"
            type="submit"
            variant="outline"
          >
            {pending ? (
              <Loader2Icon aria-hidden className="animate-spin" />
            ) : (
              "Save"
            )}
          </Button>
          <Button
            disabled={pending || document.status !== "ready"}
            onClick={summarise}
            size="sm"
            type="button"
            variant="outline"
          >
            {document.hasSummary ? "Re-summarise" : "Summarise"}
          </Button>
          <Button
            disabled={pending}
            onClick={remove}
            size="sm"
            type="button"
            variant="ghost"
          >
            Remove
          </Button>
        </div>
      </form>

      {document.hasSummary ? (
        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
          <p className="text-sm">{document.summary}</p>
          {document.keyFacts.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
              {document.keyFacts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Not summarised yet. Summarising costs a small amount and is what lets
          the studio use this document without spending the whole context on it.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Higher priority survives truncation when the context runs out of room.
      </p>

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
