import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        <ul>
          {items.map((item) => (
            <li
              className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
              key={item.id}
            >
              <div className="space-y-1">
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
                {item.action ? (
                  <p className="text-sm text-foreground">Next: {item.action}</p>
                ) : null}
              </div>
              <ReadinessStatusBadge status={item.status} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
