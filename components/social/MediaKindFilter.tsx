import Link from "next/link";
import type { MediaAssetKind } from "@/db/schema";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { kind: null, label: "All" },
  { kind: "image", label: "Images" },
  { kind: "video", label: "Videos" },
] as const satisfies readonly { kind: MediaAssetKind | null; label: string }[];

/**
 * Links rather than client state, so the filter is bookmarkable and the server
 * can apply it to the query — the library is paginated, so filtering only what
 * one page happened to contain would be misleading.
 */
export function MediaKindFilter({ active }: { active: MediaAssetKind | null }) {
  return (
    <nav aria-label="Filter media by kind" className="flex gap-1">
      {OPTIONS.map((option) => (
        <Button
          key={option.label}
          nativeButton={false}
          render={
            <Link
              href={
                option.kind
                  ? `/app/social/library?kind=${option.kind}`
                  : "/app/social/library"
              }
            />
          }
          size="sm"
          variant={active === option.kind ? "secondary" : "ghost"}
        >
          {option.label}
        </Button>
      ))}
    </nav>
  );
}
