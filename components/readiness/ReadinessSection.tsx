import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { ArrowRight, ServerCog, UsersRound } from "lucide-react";
import { Empty } from "@/components/ui/Empty";
import { Badge } from "@/components/ui/badge";
import { ReadinessStatusBadge } from "@/components/readiness/ReadinessStatusBadge";
import type { ReadinessItem } from "@/lib/readiness/readiness";

export function ReadinessSection({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: ReadinessItem[];
}) {
  return (
    <Card className="min-w-0 self-start">
      <CardHeader className="border-b">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-secondary">
            {title === "Deployment" ? (
              <ServerCog aria-hidden="true" className="size-5" />
            ) : (
              <UsersRound aria-hidden="true" className="size-5" />
            )}
          </div>
          <Badge variant="secondary">{items.length} checks</Badge>
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length ? (
          <ul className="divide-y">
            {items.map((item) => (
              <li
                className="flex flex-wrap items-start justify-between gap-3 py-5 first:pt-0 last:pb-0"
                key={item.id}
              >
                <div className="min-w-0 flex-1 basis-48 space-y-2">
                  <h3 className="text-sm font-semibold">{item.label}</h3>
                  <p className="break-words text-sm leading-relaxed text-muted-foreground">
                    {item.detail}
                  </p>
                  {item.action ? (
                    <div className="flex items-start gap-2 rounded-lg bg-muted/65 p-3 text-xs leading-relaxed">
                      <ArrowRight
                        aria-hidden="true"
                        className="mt-0.5 size-3.5 shrink-0"
                      />
                      <p className="min-w-0 break-words">
                        <span className="font-semibold">Next step: </span>
                        {item.action}
                      </p>
                    </div>
                  ) : null}
                </div>
                <ReadinessStatusBadge status={item.status} />
              </li>
            ))}
          </ul>
        ) : (
          <Empty>
            <p className="text-sm text-muted-foreground">
              No checks reported in this section.
            </p>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
