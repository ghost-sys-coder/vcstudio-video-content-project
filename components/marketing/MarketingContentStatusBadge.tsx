import { Badge } from "@/components/ui/badge";
import type { MarketingContentStatus } from "@/db/schema";
export function MarketingContentStatusBadge({
  status,
}: {
  status: MarketingContentStatus;
}) {
  return <Badge variant="outline">{status.replaceAll("_", " ")}</Badge>;
}
