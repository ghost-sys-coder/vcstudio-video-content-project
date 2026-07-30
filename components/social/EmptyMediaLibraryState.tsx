import { ImagePlusIcon } from "lucide-react";

export function EmptyMediaLibraryState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/30 p-10 text-center">
      <ImagePlusIcon aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">
        {filtered ? "Nothing of that kind yet" : "The library is empty"}
      </p>
      <p className="max-w-md text-sm text-muted-foreground">
        {filtered
          ? "Clear the filter to see everything in this workspace, or upload something new."
          : "Upload the images and videos you want to reuse across posts. They stay in the workspace, so they are available to every project."}
      </p>
    </div>
  );
}
