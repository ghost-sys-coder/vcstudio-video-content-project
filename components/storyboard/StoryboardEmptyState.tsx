import { LayoutGridIcon } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function StoryboardEmptyState({ projectId }: { projectId: string }) {
  return (
    <div className="rounded-xl border border-dashed p-12 text-center">
      <LayoutGridIcon className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-4 font-semibold">No scenes to storyboard yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Create scenes yourself or analyze an approved script. Approve the scenes
        before generating images here in bulk.
      </p>
      <Link
        className={`mt-5 ${buttonVariants({ variant: "outline" })}`}
        href={`/app/projects/${projectId}/scenes`}
      >
        Open Scene detail
      </Link>
    </div>
  );
}
