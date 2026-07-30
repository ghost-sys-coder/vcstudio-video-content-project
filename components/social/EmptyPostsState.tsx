import { MegaphoneIcon } from "lucide-react";

export function EmptyPostsState() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-muted/30 p-10 text-center">
      <MegaphoneIcon aria-hidden className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">No posts yet</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Write a post once and send it to several connected accounts. The
        composer shows exactly what each platform will receive before anything
        goes out.
      </p>
    </div>
  );
}
