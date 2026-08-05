const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function parseDateValue(value: unknown): Date | null {
  if (!(value instanceof Date) && typeof value !== "string") return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatShortDate(value: Date | string): string {
  const date = parseDateValue(value);
  if (!date) throw new RangeError("INVALID_DATE_VALUE");
  return shortDateFormatter.format(date);
}
