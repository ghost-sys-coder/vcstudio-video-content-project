import Link from "next/link";
import { Button } from "@/components/ui/button";

export function MarketingMetricsRangeFilter({ days }: { days: number }) {
  return (
    <nav aria-label="Metrics date range" className="flex flex-wrap gap-2">
      {[30, 90, 180].map((value) => (
        <Button
          key={value}
          nativeButton={false}
          size="sm"
          variant={days === value ? "default" : "outline"}
          render={<Link href={`/app/marketing/metrics?range=${value}`} />}
        >
          Last {value} days
        </Button>
      ))}
    </nav>
  );
}
