import type { SocialPostStatus } from "@/db/schema";
import { Badge } from "@/components/ui/badge";

const PRESENTATION = {
  draft: { label: "Draft", variant: "outline" },
  scheduled: { label: "Scheduled", variant: "secondary" },
  publishing: { label: "Publishing", variant: "secondary" },
  published: { label: "Published", variant: "default" },
  // Its own badge, not folded into "Failed": some destinations did go out, and
  // saying otherwise would send someone hunting for posts that already exist.
  partially_failed: { label: "Partly delivered", variant: "destructive" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "outline" },
  awaiting_completion: { label: "Finish in TikTok", variant: "secondary" },
} as const satisfies Record<
  SocialPostStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
>;

export function PostStatusBadge({ status }: { status: SocialPostStatus }) {
  const presentation = PRESENTATION[status];
  return <Badge variant={presentation.variant}>{presentation.label}</Badge>;
}
