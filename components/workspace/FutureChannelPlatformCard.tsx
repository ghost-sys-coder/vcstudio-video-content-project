import { Clock3Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function FutureChannelPlatformCard({ label }: { label: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-dashed bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Clock3Icon aria-hidden className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            Channel connections are planned.
          </p>
        </div>
      </div>
      <Badge variant="secondary">Coming soon</Badge>
    </li>
  );
}
