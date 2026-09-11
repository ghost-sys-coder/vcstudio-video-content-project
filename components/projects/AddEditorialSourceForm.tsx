"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UNTRUSTED_SOURCE_NOTICE } from "@/lib/editorial/source-input";

/**
 * Adds one source by hand.
 *
 * A link and a note are separate kinds rather than one field with an optional
 * URL, because they are different strengths of evidence and a reader has to be
 * able to tell which is holding a claim up.
 */
export function AddEditorialSourceForm({
  busy,
  onAdd,
}: {
  busy: boolean;
  onAdd: (input: {
    kind: "link" | "note";
    title: string;
    url: string;
    notes: string;
  }) => Promise<boolean>;
}) {
  const [kind, setKind] = useState<"link" | "note">("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form
      className="space-y-3 rounded-xl border p-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const added = await onAdd({ kind, title, url, notes });
        if (!added) return;
        setTitle("");
        setUrl("");
        setNotes("");
      }}
    >
      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: "link", label: "Link" },
            { value: "note", label: "Note" },
          ] as const
        ).map((option) => (
          <label
            className={`cursor-pointer rounded-lg border px-3 py-1 text-xs transition-colors ${
              kind === option.value
                ? "border-primary bg-primary/10 font-medium text-primary"
                : "hover:bg-muted"
            }`}
            key={option.value}
          >
            <input
              checked={kind === option.value}
              className="sr-only"
              name="source-kind"
              onChange={() => setKind(option.value)}
              type="radio"
            />
            {option.label}
          </label>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor="source-title">
          Title
        </Label>
        <Input
          disabled={busy}
          id="source-title"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What is this source?"
          value={title}
        />
      </div>

      {kind === "link" ? (
        <div className="space-y-1.5">
          <Label className="text-xs" htmlFor="source-url">
            Link
          </Label>
          <Input
            disabled={busy}
            id="source-url"
            inputMode="url"
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://"
            value={url}
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label className="text-xs" htmlFor="source-notes">
          What it says
        </Label>
        <Textarea
          className="max-h-40 overflow-y-auto"
          disabled={busy}
          id="source-notes"
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          value={notes}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {UNTRUSTED_SOURCE_NOTICE}
        </p>
        <Button disabled={busy || title.trim().length === 0} size="sm">
          Add source
        </Button>
      </div>
    </form>
  );
}
