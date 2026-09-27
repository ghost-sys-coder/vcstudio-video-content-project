"use client";

import { CopyButton } from "@/components/ui/CopyButton";

/** The exact lines that will be added to the end of the YouTube description. */
export function ChapterDescriptionPreview({ block }: { block: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Added to the YouTube description</p>
        <CopyButton label="chapter timestamps" value={block} />
      </div>
      <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
        {block}
      </pre>
    </div>
  );
}
