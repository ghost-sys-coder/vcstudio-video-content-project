import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdCents } from "@/lib/format/currency";

export function UsageSummaryCards({
  monthToDateCents,
  dayToDateCents,
  pendingReservedCents,
  totalReconciledCents,
}: {
  monthToDateCents: number;
  dayToDateCents: number;
  pendingReservedCents: number;
  totalReconciledCents: number;
}) {
  const cards = [
    { label: "Spent this month", value: monthToDateCents },
    { label: "Spent today", value: dayToDateCents },
    { label: "Reserved (pending)", value: pendingReservedCents },
    { label: "Settled (all time)", value: totalReconciledCents },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {formatUsdCents(card.value)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
