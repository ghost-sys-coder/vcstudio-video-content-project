import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdCents } from "@/lib/format/currency";
import { CalendarDays, Clock3, LockKeyhole, CircleCheck } from "lucide-react";

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
    {
      label: "Committed this month",
      value: monthToDateCents,
      detail: "Current UTC month",
      icon: CalendarDays,
    },
    {
      label: "Committed today",
      value: dayToDateCents,
      detail: "Current UTC day",
      icon: Clock3,
    },
    {
      label: "Reserved",
      value: pendingReservedCents,
      detail: "Held for pending work",
      icon: LockKeyhole,
    },
    {
      label: "Settled total",
      value: totalReconciledCents,
      detail: "Reconciled usage, all time",
      icon: CircleCheck,
    },
  ];

  return (
    <div className="app-grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ icon: Icon, ...card }) => (
        <Card key={card.label} className="min-w-0 gap-4">
          <CardHeader>
            <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-secondary">
              <Icon aria-hidden="true" className="size-4" />
            </div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tracking-tight tabular-nums">
              {formatUsdCents(card.value)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
