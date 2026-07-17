import { LayoutGridIcon } from "lucide-react";

export function StoryboardEmptyState() {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <LayoutGridIcon className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-4 font-semibold">No scenes to storyboard yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Approve a script version and run scene analysis, then approve scenes to
        generate their images here in bulk.
      </p>
    </div>
  );
}
