import { Badge } from "@/components/ui/badge";
import type { ContentPlatform } from "@/db/schema";

const CHANNEL_CLASSNAMES: Record<ContentPlatform, string> = {
  youtube: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  tiktok: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
  facebook: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  instagram:
    "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300",
};

export function VideoPublicationChannelBadge({
  platform,
  label,
}: {
  platform: ContentPlatform;
  label: string;
}) {
  return (
    <Badge className={`h-auto px-2.5 py-1 ${CHANNEL_CLASSNAMES[platform]}`}>
      {label}
    </Badge>
  );
}
