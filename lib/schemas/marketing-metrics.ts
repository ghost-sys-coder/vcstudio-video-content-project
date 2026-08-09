import { z } from "zod";

export const marketingMetricsRangeSchema = z.enum(["30", "90", "180"]);

export function parseMarketingMetricsRange(input: unknown, now = new Date()) {
  const days = Number(marketingMetricsRangeSchema.catch("30").parse(input));
  const to = new Date(now);
  const from = new Date(to.getTime() - days * 86_400_000);
  const previousTo = from;
  const previousFrom = new Date(previousTo.getTime() - days * 86_400_000);
  return { days, from, to, previousFrom, previousTo };
}
