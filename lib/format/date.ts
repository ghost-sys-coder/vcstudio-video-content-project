const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatShortDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return shortDateFormatter.format(date);
}
