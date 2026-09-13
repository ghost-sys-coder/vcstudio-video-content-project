"use client";

import { CopyButton } from "@/components/ui/CopyButton";
import { Badge } from "@/components/ui/badge";

export function ImagePromptPreview({
  id,
  prompt,
  promptTemplateVersion,
  sizeLabel,
}: {
  id: string;
  prompt: string;
  promptTemplateVersion: string;
  sizeLabel?: string;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium" id={`${id}-heading`}>
          Prompt preview{sizeLabel ? ` — ${sizeLabel}` : ""}
        </h3>
        <div className="flex items-center gap-2">
          {/* The prompt is what a generation is actually held to, so being able
              to take it away and compare it is worth more than it looks. */}
          <CopyButton label="prompt" value={prompt} />
          <Badge variant="secondary">Template {promptTemplateVersion}</Badge>
        </div>
      </div>
      <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border bg-muted/30 p-4 font-sans text-xs leading-5 text-foreground">
        {prompt || "Choose a style preset to preview the exact prompt."}
      </pre>
      <p className="text-xs text-muted-foreground">
        The exact prompt shown here is stored with the generation record.
      </p>
    </section>
  );
}
