import type { MarketingContentItem } from "@/db/schema";
import { adCreativePayloadSchema } from "@/lib/schemas/marketing-campaign";

function cell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

export function createAdCreativeCsv(items: MarketingContentItem[]): string {
  const rows = items.flatMap((item) => {
    if (item.kind !== "ad_creative") return [];
    const parsed = adCreativePayloadSchema.safeParse(item.structuredPayload);
    if (!parsed.success) return [];
    const value = parsed.data;
    return [
      [
        value.variantLabel,
        value.platform,
        value.placement,
        value.headline,
        value.primaryText,
        value.description,
        value.cta,
      ],
    ];
  });
  return [
    [
      "Variant",
      "Platform",
      "Placement",
      "Headline",
      "Primary text",
      "Description",
      "CTA",
    ],
    ...rows,
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
}
