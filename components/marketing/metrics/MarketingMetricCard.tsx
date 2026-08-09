export function MarketingMetricCard({
  label,
  value,
  previous,
  note,
}: {
  label: string;
  value: string;
  previous?: string;
  note: string;
}) {
  return (
    <article className="rounded-2xl border bg-card p-5 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      {previous ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Previous period: {previous}
        </p>
      ) : null}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {note}
      </p>
    </article>
  );
}
