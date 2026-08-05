import { describe, expect, it } from "vitest";
import { createAdCreativeCsv } from "@/lib/marketing/campaigns/ad-creative-csv";

describe("createAdCreativeCsv", () => {
  it("exports valid ad variants and escapes quotes", () => {
    const csv = createAdCreativeCsv([
      {
        kind: "ad_creative",
        structuredPayload: {
          headline: 'A "better" site',
          primaryText: "Convert more visitors",
          description: "A clear offer",
          cta: "Learn more",
          platform: "facebook",
          placement: "feed",
          variantLabel: "A",
        },
      },
      { kind: "social_post", structuredPayload: null },
    ] as never);
    expect(csv).toContain('"A ""better"" site"');
    expect(csv).toContain('"facebook"');
    expect(csv.split("\r\n")).toHaveLength(2);
  });
});
